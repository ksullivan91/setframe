import { describe, expect, it } from 'vitest';
import type { AdditionalActivityType } from '@setframe/schemas';
import { additionalActivityFieldsByType, getAdditionalActivityFields } from './additional-activity-fields';

const allTypes: AdditionalActivityType[] = [
  'walk',
  'run',
  'outdoor_cycle',
  'indoor_cycle',
  'yoga',
  'mobility',
  'foam_rolling',
  'stretching',
  'other',
];

describe('additionalActivityFieldsByType', () => {
  it('covers every activity type with no gaps', () => {
    for (const type of allTypes) {
      expect(additionalActivityFieldsByType[type]).toBeDefined();
      expect(additionalActivityFieldsByType[type].length).toBeGreaterThan(0);
    }
  });

  it('never exposes weight/sets/reps/RPE fields for any type', () => {
    const forbidden = ['weight', 'sets', 'reps', 'rpe'];
    for (const type of allTypes) {
      for (const field of additionalActivityFieldsByType[type]) {
        expect(forbidden).not.toContain(field);
      }
    }
  });

  it('shows distance for distance-based activities, not for stationary ones', () => {
    expect(getAdditionalActivityFields('walk')).toContain('distance');
    expect(getAdditionalActivityFields('run')).toContain('distance');
    expect(getAdditionalActivityFields('outdoor_cycle')).toContain('distance');
    expect(getAdditionalActivityFields('yoga')).not.toContain('distance');
    expect(getAdditionalActivityFields('mobility')).not.toContain('distance');
    expect(getAdditionalActivityFields('stretching')).not.toContain('distance');
  });

  it('only shows the activity-name field for "other"', () => {
    for (const type of allTypes) {
      if (type === 'other') {
        expect(getAdditionalActivityFields(type)).toContain('title');
      } else {
        expect(getAdditionalActivityFields(type)).not.toContain('title');
      }
    }
  });
});
