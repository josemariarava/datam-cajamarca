import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'votapp-offline'
const STORE_NAME = 'pending-votes'

let dbPromise: Promise<IDBPDatabase>

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function addPendingVote(voteData: Record<string, unknown>, token: string) {
  const db = await getDB()
  await db.add(STORE_NAME, { data: voteData, token, created_at: new Date().toISOString(), synced: false })
}

export async function getPendingVotes() {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function removePendingVote(id: number) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function syncPendingVotes() {
  const pending = await getPendingVotes()
  const unsynced = pending.filter(v => !v.synced)

  for (const vote of unsynced) {
    try {
      const res = await fetch('/api/votes/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vote.token}`,
        },
        body: JSON.stringify(vote.data),
      })

      if (res.ok) {
        await removePendingVote(vote.id)
      }
    } catch {
      // Will retry next sync
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingVotes()
  })
}
