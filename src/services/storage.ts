import { openDB } from 'idb';
import type { WorkSession } from '../models/types';
// Isolated per hosting subdirectory; no external storage or telemetry.
const db = () => openDB(`seaes-utsjr:${new URL('.', location.href).pathname}`, 1, { upgrade(database) { database.createObjectStore('session'); database.createObjectStore('files'); } });
export async function loadSession(): Promise<WorkSession | undefined> { return (await db()).get('session', 'current'); }
export async function saveSession(session: WorkSession) { return (await db()).put('session', session, 'current'); }
export async function storeOriginal(id: string, data: ArrayBuffer) { return (await db()).put('files', data, id); }
export async function deleteOriginal(id: string) { return (await db()).delete('files', id); }
export async function clearOriginals() { return (await db()).clear('files'); }
