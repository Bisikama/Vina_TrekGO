const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../..");
function load(file, deps = {}, extras = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {}, __DEV__: true, Date, Math, Number, setInterval, clearInterval,
    require(id) {
      if (id in deps) return deps[id];
      throw new Error("Unexpected runtime dependency: " + id);
    },
    ...extras,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
function harness(dev = true, customConfig) {
  let now = Date.now();
  let nextId = 0;
  const timers = new Map();
  class Clock extends Date { static now() { return now; } }
  const gps = load("src/utils/gpsProcessor.ts", {}, { Date: Clock });
  const config = customConfig ?? JSON.parse(JSON.stringify(
    load("src/constants/personalTrailSimulation.ts").PERSONAL_TRAIL_SIMULATION));
  const service = load("src/services/location/personalTrailSimulation.ts", {
    "@/constants/personalTrailSimulation": { PERSONAL_TRAIL_SIMULATION: config },
    "@/utils/gpsProcessor": gps,
  }, {
    __DEV__: dev, Date: Clock,
    setInterval(fn) { timers.set(++nextId, fn); return nextId; },
    clearInterval(id) { timers.delete(id); },
  });
  return {
    service, config, gps, timers, now: () => now,
    advance(ms = 1000) { now += ms; for (const fn of [...timers.values()]) fn(); },
  };
}

test("local simulated fixes pass the actual GPS filter and accumulate walking distance", () => {
  const h = harness();
  h.service.preparePersonalTrailSimulation();
  const processor = new h.gps.GpsProcessor();
  processor.reset(h.now());
  const results = [];
  const subscription = h.service.startPersonalTrailSimulation(sample => {
    assert.equal(sample.timestamp, h.now());
    assert.equal(sample.mocked, true);
    results.push(processor.process(sample));
  });
  for (let i = 0; i < 30; i++) h.advance();
  assert(results.filter(r => r.accepted).length >= 6);
  assert(results.at(-1).distanceM > 30);
  assert.equal(results.at(-1).elevationGainM, 0);
  subscription.remove();
  assert.equal(h.timers.size, 0);
});

test("pause/resume preserves position and does not include paused time", () => {
  const h = harness();
  h.service.preparePersonalTrailSimulation();
  const samples = [];
  h.service.startPersonalTrailSimulation(sample => samples.push(sample));
  h.advance();
  h.service.pausePersonalTrailSimulation();
  const before = h.service.getPersonalTrailSimulationLocation();
  h.advance(60000);
  assert.equal(samples.length, 1);
  assert.equal(h.service.getPersonalTrailSimulationLocation().coords.latitude, before.coords.latitude);
  h.service.resumePersonalTrailSimulation();
  h.advance();
  const after = samples.at(-1);
  const distance = h.gps.distanceMeters(before.coords, after.coords);
  assert(Math.abs(distance - h.config.route.speed) < 0.05);
});

test("delayed JS timers never teleport across the route", () => {
  const h = harness();
  h.service.preparePersonalTrailSimulation();
  const first = h.service.getPersonalTrailSimulationLocation();
  h.service.startPersonalTrailSimulation(() => {});
  h.advance(60000);
  const next = h.service.getPersonalTrailSimulationLocation();
  assert(h.gps.distanceMeters(first.coords, next.coords) <= h.config.route.speed * 2 + 0.05);
});

test("reaches final point, interpolates altitude, stops and cleans up", () => {
  const h = harness();
  const config = { ...h.config, route: {
    ...h.config.route,
    points: [
      { latitude: 11.58, longitude: 108.53, altitudeM: 1000 },
      { latitude: 11.5801, longitude: 108.53, altitudeM: 1020 },
    ],
  } };
  const sim = new h.service.PersonalTrailSimulator(config);
  const samples = [];
  const subscription = sim.subscribe(sample => samples.push(sample));
  h.advance();
  assert(samples[0].coords.altitude > 1000 && samples[0].coords.altitude < 1020);
  for (let i = 0; i < 20; i++) h.advance();
  const count = samples.length;
  h.advance();
  assert.equal(samples.length, count);
  assert.equal(sim.getCurrentLocation().coords.latitude, 11.5801);
  assert.equal(sim.getCurrentLocation().coords.altitude, 1020);
  assert.equal(sim.getCurrentLocation().coords.speed, 0);
  subscription.remove();
  assert.equal(h.timers.size, 0);
});

test("reset stops delivery, and a new session starts at its first point", () => {
  const h = harness();
  h.service.preparePersonalTrailSimulation();
  let count = 0;
  h.service.startPersonalTrailSimulation(() => count++);
  h.advance();
  h.service.resetPersonalTrailSimulation();
  h.advance();
  assert.equal(count, 1);
  assert.equal(h.timers.size, 0);
  h.service.preparePersonalTrailSimulation();
  assert.equal(h.service.getPersonalTrailSimulationLocation().coords.latitude, h.config.route.points[0].latitude);
});

test("invalid configurations and production activation are rejected", () => {
  const h = harness();
  assert.throws(() => new h.service.PersonalTrailSimulator({
    ...h.config, route: { ...h.config.route, speed: 99 },
  }));
  assert.throws(() => new h.service.PersonalTrailSimulator({
    ...h.config, route: { ...h.config.route, points: [{ latitude: 91, longitude: 0 }, h.config.route.points[0]] },
  }));
  assert.throws(() => new h.service.PersonalTrailSimulator({
    ...h.config, route: { ...h.config.route, points: [h.config.route.points[0], h.config.route.points[0]] },
  }));
  assert.throws(() => harness(false).service.preparePersonalTrailSimulation());
});
