// lib/doorMemory.ts
//
// Whether this browser has been through the door before. One boolean in
// localStorage -- not an account, not a profile, not a claim about WHO.
//
// Honesty bound (docs/inhabiting-the-elder.md, M2): all this knows is that
// this browser once crossed or chose to skip. It is lost when storage is
// cleared and shared by whoever uses the device, so nothing in the interface
// may greet a person on the strength of it. It changes the shape of the door
// (shorter, already ajar) and one plain line about the fire -- never a
// "welcome back".

export const DOOR_KEY = 'elder_door_v1';

export function readDoorKnown(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DOOR_KEY) === '1';
  } catch {
    return false; // private mode / blocked storage: treat as a first crossing
  }
}

export function writeDoorKnown(): void {
  try {
    window.localStorage.setItem(DOOR_KEY, '1');
  } catch { /* storage unavailable: the door simply stays the long one */ }
}
