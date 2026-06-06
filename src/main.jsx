import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// StrictModeを外す（setStateコールバックの2重実行を防ぐ）
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
