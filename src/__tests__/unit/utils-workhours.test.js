import { describe, it, expect } from 'vitest';
import { 
  snapToNextWorkStart, 
  addMinutesWithinWorkHours,
  DEFAULT_WORKDAY 
} from '@/Pages/Admin/Commandes/utils/workhours';

describe('workhours utilities', () => {
  describe('snapToNextWorkStart', () => {
    it('snaps to next work start when time is before work hours', () => {
      const date = new Date('2025-01-10T06:00:00'); // 6 AM, before 7 AM start
      const result = snapToNextWorkStart(date, DEFAULT_WORKDAY);

      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });

    it('returns same time when within work hours', () => {
      const date = new Date('2025-01-10T10:00:00'); // 10 AM, within work hours
      const result = snapToNextWorkStart(date, DEFAULT_WORKDAY);

      expect(result.getHours()).toBe(10);
      expect(result.getMinutes()).toBe(0);
    });

    it('snaps to next day when after work hours', () => {
      const date = new Date('2025-01-10T18:00:00'); // 6 PM, after 4 PM end
      const result = snapToNextWorkStart(date, DEFAULT_WORKDAY);

      expect(result.getDate()).toBe(13); // Next Monday (assuming Friday)
      expect(result.getHours()).toBe(7);
    });

    it('skips weekend to Monday', () => {
      const saturday = new Date('2025-01-11T10:00:00'); // Saturday
      const result = snapToNextWorkStart(saturday, DEFAULT_WORKDAY);

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getHours()).toBe(7);
    });

    it('handles lunch break correctly', () => {
      const date = new Date('2025-01-10T12:30:00'); // During lunch
      const result = snapToNextWorkStart(date, DEFAULT_WORKDAY);

      expect(result.getHours()).toBe(13);
      expect(result.getMinutes()).toBe(0); // lunch break ends at 13:00
    });
  });

  describe('addMinutesWithinWorkHours', () => {
    it('adds minutes within same work period', () => {
      const start = new Date('2025-01-10T09:00:00'); // 9 AM
      const result = addMinutesWithinWorkHours(start, 60, DEFAULT_WORKDAY);
      
      expect(result.end.getHours()).toBe(10);
      expect(result.actualMinutes).toBe(60);
    });

    it('skips lunch break when crossing it', () => {
      const start = new Date('2025-01-10T11:30:00'); // 11:30 AM
      const result = addMinutesWithinWorkHours(start, 120, DEFAULT_WORKDAY); // 2 hours
      
      // Should end at 2:00 PM (11:30 + 30min to lunch + 90min after lunch)
      expect(result.end.getHours()).toBe(14);
      expect(result.actualMinutes).toBe(120);
    });

    it('handles overnight work correctly', () => {
      const start = new Date('2025-01-10T17:00:00'); // 5 PM
      const result = addMinutesWithinWorkHours(start, 120, DEFAULT_WORKDAY); // 2 hours
      
      // Should continue next business day
      expect(result.end.getDate()).toBe(13); // Next Monday
      expect(result.actualMinutes).toBe(120);
    });

    it('handles zero minutes', () => {
      const start = new Date('2025-01-10T09:00:00');
      const result = addMinutesWithinWorkHours(start, 0, DEFAULT_WORKDAY);
      
      expect(result.end.getTime()).toBe(start.getTime());
      expect(result.actualMinutes).toBe(0);
    });

    it('handles large duration spanning multiple days', () => {
      const start = new Date('2025-01-10T09:00:00');
      const result = addMinutesWithinWorkHours(start, 960, DEFAULT_WORKDAY); // 16 hours = 2+ days (adjusted for lunch break)

      expect(result.end.getDate()).toBe(14); // Adjusted for 8h workday with 1h lunch: ~2.28 working days
      expect(result.actualMinutes).toBe(960);
    });

    it('respects weekend boundaries', () => {
      const friday = new Date('2025-01-10T16:00:00'); // Friday 4 PM
      const result = addMinutesWithinWorkHours(friday, 240, DEFAULT_WORKDAY); // 4 hours
      
      // Should skip weekend to Monday
      expect(result.end.getDay()).toBe(1); // Monday
    });
  });

  describe('DEFAULT_WORKDAY', () => {
    it('has correct structure', () => {
      expect(DEFAULT_WORKDAY).toHaveProperty('start');
      expect(DEFAULT_WORKDAY).toHaveProperty('lunchStart');
      expect(DEFAULT_WORKDAY).toHaveProperty('lunchEnd');
      expect(DEFAULT_WORKDAY).toHaveProperty('end');
    });

    it('has valid work hours', () => {
      expect(DEFAULT_WORKDAY.start).toBeLessThan(DEFAULT_WORKDAY.lunchStart);
      expect(DEFAULT_WORKDAY.lunchStart).toBeLessThan(DEFAULT_WORKDAY.lunchEnd);
      expect(DEFAULT_WORKDAY.lunchEnd).toBeLessThan(DEFAULT_WORKDAY.end);
    });
  });
});
