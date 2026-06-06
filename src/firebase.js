import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

const DOC_REF = () => doc(db, 'wc2026', 'shared')

// Firestore からデータを1回読み込む
export async function dbLoad() {
  try {
    const snap = await getDoc(DOC_REF())
    if (snap.exists()) return snap.data().state ?? null
  } catch (e) {
    console.error('dbLoad error:', e)
  }
  return null
}

// Firestore にデータを保存する
export async function dbSave(state) {
  try {
    await setDoc(DOC_REF(), { state }, { merge: false })
  } catch (e) {
    console.error('dbSave error:', e)
  }
}

// リアルタイム購読（データが変わると callback が呼ばれる）
export function dbSubscribe(callback) {
  return onSnapshot(DOC_REF(), (snap) => {
    if (snap.exists()) {
      callback(snap.data().state ?? null)
    }
  })
}
