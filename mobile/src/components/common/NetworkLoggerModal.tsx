import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import NetworkLogger, { startNetworkLogging } from "react-native-network-logger";
import { SafeAreaView } from "react-native-safe-area-context";

// @ts-ignore - access internal singleton to feed native fetch events
import logger from "react-native-network-logger/lib/module/loggerSingleton.js";

// Enable standard XHR interception with forceEnable to override other debuggers
startNetworkLogging({ forceEnable: true });

// React Native Hermes Native Fetch Interceptor:
// In modern RN (0.76+), fetch is implemented natively in Hermes and does not use XMLHttpRequest,
// so we hook global fetch to feed requests directly into the network logger singleton.
const g = globalThis as any;
if (typeof g !== "undefined" && !g.__trekgo_fetch_intercepted__) {
  g.__trekgo_fetch_intercepted__ = true;
  const originalFetch = g.fetch;

  g.fetch = async function (input: any, init?: RequestInit) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input?.url || String(input);
    const method = (init?.method || "GET").toUpperCase();
    const body =
      typeof init?.body === "string"
        ? init.body
        : init?.body
        ? JSON.stringify(init.body)
        : undefined;

    const fakeXhr: any = { _index: 0, responseHeaders: {} };

    try {
      logger.openCallback(method, url, fakeXhr);
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v: string, k: string) =>
            logger.requestHeadersCallback(k, v, fakeXhr),
          );
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]: [string, string]) =>
            logger.requestHeadersCallback(k, v, fakeXhr),
          );
        } else {
          Object.entries(init.headers).forEach(([k, v]) =>
            logger.requestHeadersCallback(k, String(v), fakeXhr),
          );
        }
      }
      logger.sendCallback(body, fakeXhr);
    } catch {
      // ignore
    }

    console.log(`🌐 [API ${method}] ${url}`);

    try {
      const response = await originalFetch(input, init);

      try {
        const cloned = response.clone();
        cloned
          .text()
          .then((text: string) => {
            try {
              const respHeaders: Record<string, string> = {};
              if (cloned.headers && typeof (cloned.headers as any).forEach === "function") {
                cloned.headers.forEach((v: string, k: string) => {
                  respHeaders[k] = v;
                });
              }
              fakeXhr.responseHeaders = respHeaders;
              logger.headerReceivedCallback(
                cloned.headers?.get?.("content-type") || "application/json",
                text.length,
                respHeaders,
                fakeXhr,
              );
              logger.responseCallback(
                response.status,
                0,
                text,
                url,
                "json",
                fakeXhr,
              );
            } catch {
              // ignore
            }
            console.log(
              `📥 [API ${response.status}] ${url} -> ${text.slice(0, 150)}`,
            );
          })
          .catch(() => {});
      } catch {
        // ignore clone error
      }

      return response;
    } catch (err: any) {
      try {
        logger.responseCallback(
          0,
          0,
          err?.message || "Network Error",
          url,
          "error",
          fakeXhr,
        );
      } catch {
        // ignore
      }
      console.warn(`❌ [API ERR] ${url} -> ${err?.message}`);
      throw err;
    }
  };
}

export function NetworkLoggerModal() {
  const [visible, setVisible] = useState(false);

  // Only show in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <>
      {/* Floating Debug Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonText}>🌐 Network</Text>
      </TouchableOpacity>

      {/* Network Logger Fullscreen Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Network Inspector (F12)</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.closeButtonText}>Đóng ✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.loggerWrapper}>
            <NetworkLogger theme="dark" />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 24,
    right: 16,
    zIndex: 999999,
    backgroundColor: "rgba(22, 101, 52, 0.92)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  floatingButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#2d2d2d",
    borderBottomWidth: 1,
    borderBottomColor: "#3d3d3d",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  loggerWrapper: {
    flex: 1,
  },
});
