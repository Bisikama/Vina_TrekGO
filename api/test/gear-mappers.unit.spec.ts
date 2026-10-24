import { GearMappers } from '../src/modules/gear/domain/gear-mappers';

describe('GearMappers Unit Tests (B08: Wire/DB Agreement)', () => {
  describe('condition mapping', () => {
    it('should map wire lowercase to DB uppercase', () => {
      expect(GearMappers.condition.toDb('new')).toBe('NEW');
      expect(GearMappers.condition.toDb('good')).toBe('GOOD');
      expect(GearMappers.condition.toDb('worn')).toBe('WORN');
      expect(GearMappers.condition.toDb('poor')).toBe('POOR');
    });

    it('should map DB uppercase to wire lowercase', () => {
      expect(GearMappers.condition.toWire('NEW')).toBe('new');
      expect(GearMappers.condition.toWire('GOOD')).toBe('good');
      expect(GearMappers.condition.toWire('WORN')).toBe('worn');
      expect(GearMappers.condition.toWire('POOR')).toBe('poor');
    });

    it('should correctly map poor round-trip for R24 invariant', () => {
      const wire = 'poor';
      const db = GearMappers.condition.toDb(wire);
      expect(db).toBe('POOR');
      expect(GearMappers.condition.toWire(db)).toBe('poor');
    });
  });

  describe('source mapping', () => {
    it('should map wire to DB and back', () => {
      expect(GearMappers.source.toDb('manual')).toBe('MANUAL');
      expect(GearMappers.source.toDb('ai_image')).toBe('AI_IMAGE');
      expect(GearMappers.source.toDb('ai_link')).toBe('AI_LINK');

      expect(GearMappers.source.toWire('MANUAL')).toBe('manual');
      expect(GearMappers.source.toWire('AI_IMAGE')).toBe('ai_image');
      expect(GearMappers.source.toWire('AI_LINK')).toBe('ai_link');
    });
  });

  describe('objective mapping', () => {
    it('should map public objectives to DB and back', () => {
      expect(GearMappers.objective.toDb('MIN_RENTAL_FEE')).toBe('ECONOMICAL');
      expect(GearMappers.objective.toDb('MIN_KNOWN_TOTAL_WEIGHT')).toBe('LIGHTWEIGHT');
      expect(GearMappers.objective.toDb('MIN_KNOWN_WEIGHT')).toBe('LIGHTWEIGHT');

      expect(GearMappers.objective.toWire('ECONOMICAL')).toBe('MIN_RENTAL_FEE');
      expect(GearMappers.objective.toWire('LIGHTWEIGHT')).toBe('MIN_KNOWN_TOTAL_WEIGHT');
    });

    it('should reject BALANCED from public wire objective', () => {
      expect(() => GearMappers.objective.toDb('BALANCED')).toThrow(
        /Unsupported public wire objective/
      );
    });
  });
});

