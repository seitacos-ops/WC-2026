import { useState, useCallback, useEffect, useRef } from 'react'
import { dbLoad, dbSave, dbSubscribe } from './firebase'

// ─── 管理者パスワード（Vercel環境変数から取得）────────────
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Samuraiblue'

// ─── TEAMS（2026 W杯 正式48か国・12グループ）────────────
const TEAMS = [
  // Group A
  { id: 'MEX', name: 'メキシコ',             flag: '🇲🇽', region: 'グループA' },
  { id: 'RSA', name: '南アフリカ',           flag: '🇿🇦', region: 'グループA' },
  { id: 'KOR', name: '韓国',                 flag: '🇰🇷', region: 'グループA' },
  { id: 'CZE', name: 'チェコ',               flag: '🇨🇿', region: 'グループA' },
  // Group B
  { id: 'CAN', name: 'カナダ',               flag: '🇨🇦', region: 'グループB' },
  { id: 'BIH', name: 'ボスニア・ヘルツェゴビナ', flag: '🇧🇦', region: 'グループB' },
  { id: 'QAT', name: 'カタール',             flag: '🇶🇦', region: 'グループB' },
  { id: 'SUI', name: 'スイス',               flag: '🇨🇭', region: 'グループB' },
  // Group C
  { id: 'BRA', name: 'ブラジル',             flag: '🇧🇷', region: 'グループC' },
  { id: 'MAR', name: 'モロッコ',             flag: '🇲🇦', region: 'グループC' },
  { id: 'HAI', name: 'ハイチ',               flag: '🇭🇹', region: 'グループC' },
  { id: 'SCO', name: 'スコットランド',       flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', region: 'グループC' },
  // Group D
  { id: 'USA', name: 'アメリカ',             flag: '🇺🇸', region: 'グループD' },
  { id: 'PAR', name: 'パラグアイ',           flag: '🇵🇾', region: 'グループD' },
  { id: 'AUS', name: 'オーストラリア',       flag: '🇦🇺', region: 'グループD' },
  { id: 'TUR', name: 'トルコ',               flag: '🇹🇷', region: 'グループD' },
  // Group E
  { id: 'GER', name: 'ドイツ',               flag: '🇩🇪', region: 'グループE' },
  { id: 'CUW', name: 'キュラソー',           flag: '🇨🇼', region: 'グループE' },
  { id: 'CIV', name: 'コートジボワール',     flag: '🇨🇮', region: 'グループE' },
  { id: 'ECU', name: 'エクアドル',           flag: '🇪🇨', region: 'グループE' },
  // Group F
  { id: 'NED', name: 'オランダ',             flag: '🇳🇱', region: 'グループF' },
  { id: 'JPN', name: '日本',                 flag: '🇯🇵', region: 'グループF' },
  { id: 'SWE', name: 'スウェーデン',         flag: '🇸🇪', region: 'グループF' },
  { id: 'TUN', name: 'チュニジア',           flag: '🇹🇳', region: 'グループF' },
  // Group G
  { id: 'BEL', name: 'ベルギー',             flag: '🇧🇪', region: 'グループG' },
  { id: 'EGY', name: 'エジプト',             flag: '🇪🇬', region: 'グループG' },
  { id: 'IRN', name: 'イラン',               flag: '🇮🇷', region: 'グループG' },
  { id: 'NZL', name: 'ニュージーランド',     flag: '🇳🇿', region: 'グループG' },
  // Group H
  { id: 'ESP', name: 'スペイン',             flag: '🇪🇸', region: 'グループH' },
  { id: 'CPV', name: 'カーボベルデ',         flag: '🇨🇻', region: 'グループH' },
  { id: 'KSA', name: 'サウジアラビア',       flag: '🇸🇦', region: 'グループH' },
  { id: 'URU', name: 'ウルグアイ',           flag: '🇺🇾', region: 'グループH' },
  // Group I
  { id: 'FRA', name: 'フランス',             flag: '🇫🇷', region: 'グループI' },
  { id: 'SEN', name: 'セネガル',             flag: '🇸🇳', region: 'グループI' },
  { id: 'IRQ', name: 'イラク',               flag: '🇮🇶', region: 'グループI' },
  { id: 'NOR', name: 'ノルウェー',           flag: '🇳🇴', region: 'グループI' },
  // Group J
  { id: 'ARG', name: 'アルゼンチン',         flag: '🇦🇷', region: 'グループJ' },
  { id: 'ALG', name: 'アルジェリア',         flag: '🇩🇿', region: 'グループJ' },
  { id: 'AUT', name: 'オーストリア',         flag: '🇦🇹', region: 'グループJ' },
  { id: 'JOR', name: 'ヨルダン',             flag: '🇯🇴', region: 'グループJ' },
  // Group K
  { id: 'POR', name: 'ポルトガル',           flag: '🇵🇹', region: 'グループK' },
  { id: 'COD', name: 'コンゴ民主共和国',     flag: '🇨🇩', region: 'グループK' },
  { id: 'UZB', name: 'ウズベキスタン',       flag: '🇺🇿', region: 'グループK' },
  { id: 'COL', name: 'コロンビア',           flag: '🇨🇴', region: 'グループK' },
  // Group L
  { id: 'ENG', name: 'イングランド',         flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'グループL' },
  { id: 'CRO', name: 'クロアチア',           flag: '🇭🇷', region: 'グループL' },
  { id: 'GHA', name: 'ガーナ',               flag: '🇬🇭', region: 'グループL' },
  { id: 'PAN', name: 'パナマ',               flag: '🇵🇦', region: 'グループL' },
]

const UNIT_OPTIONS = [10000, 50000, 100000, 200000, 500000]
const LOTS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const fmt = (n) => n.toLocaleString('ja-JP') + ' VND'
const fmtOdds = (n) => n.toFixed(2) + 'x'

// ─── INIT STATE ──────────────────────────────────────────
const INIT_STATE = {
  settings: { unit: 10000, feeRate: 10 },
  participants: [],
  winner: null,
  status: 'open',
}

// ─── HELPERS ─────────────────────────────────────────────
function computeStats(participants) {
  const m = {}
  TEAMS.forEach(t => { m[t.id] = { voters: 0, lots: 0, amount: 0, names: [] } })
  participants.forEach(p => p.bets.forEach(b => {
    m[b.teamId].voters++
    m[b.teamId].lots += b.lots
    m[b.teamId].amount += b.amount
    m[b.teamId].names.push(p.name)
  }))
  return m
}

function computeOdds(teamStats, feeRate) {
  const totalPool = Object.values(teamStats).reduce((a, s) => a + s.amount, 0)
  const netPool = totalPool * (1 - feeRate / 100)
  const odds = {}
  TEAMS.forEach(t => {
    odds[t.id] = teamStats[t.id].amount > 0 ? Math.max(1.01, netPool / teamStats[t.id].amount) : null
  })
  return { odds, totalPool, netPool }
}

function computeWinnings(participants, winner, teamStats, feeRate) {
  if (!winner) return []
  const { netPool } = computeOdds(teamStats, feeRate)
  const ws = teamStats[winner]
  if (!ws || ws.amount === 0) return []
  return participants.map(p => {
    const bet = p.bets.find(b => b.teamId === winner)
    if (!bet) return null
    const winAmount = Math.floor(netPool * (bet.amount / ws.amount))
    return { name: p.name, betAmount: bet.amount, lots: bet.lots, winAmount, profit: winAmount - bet.amount }
  }).filter(Boolean)
}

function exportCSV(participants, teamStats, odds, winner, feeRate) {
  const winnings = winner ? computeWinnings(participants, winner, teamStats, feeRate) : []
  const rows = [['参加者名','国','口数','投票額(VND)','倍率','当選','受取額(VND)','損益(VND)']]
  participants.forEach(p => p.bets.forEach(b => {
    const team = TEAMS.find(t => t.id === b.teamId)
    const isW = winner === b.teamId
    const w = winnings.find(w => w.name === p.name && isW)
    rows.push([p.name, team?.name||'', b.lots, b.amount, odds[b.teamId]?.toFixed(2)||'-', isW?'✓':'', w?w.winAmount:'', w?w.profit:''])
  }))
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})),
    download: 'wc2026_result.csv'
  })
  a.click()
}

// ─── DESIGN TOKENS ───────────────────────────────────────
const C = {
  bg: '#0c0d0f', surface: '#13151a', border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(255,120,40,0.4)',
  orange: '#ff6b1a', orangeLight: '#ff8c42',
  orangeDim: 'rgba(255,107,26,0.12)', orangeGlow: 'rgba(255,107,26,0.25)',
  text: '#f0f0f0', textMuted: 'rgba(255,255,255,0.45)', textFaint: 'rgba(255,255,255,0.22)',
  green: '#2ecc71', red: '#e74c3c', blue: '#4a9eff',
}
const REGION_COLOR = {
  'グループA':'#ff6b6b','グループB':'#ffa94d','グループC':'#ffe066',
  'グループD':'#69db7c','グループE':'#38d9a9','グループF':'#4dabf7',
  'グループG':'#748ffc','グループH':'#da77f2','グループI':'#f783ac',
  'グループJ':'#a9e34b','グループK':'#63e6be','グループL':'#74c0fc',
}

const card       = (x={}) => ({ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:20, marginBottom:14, ...x })
const btnOrange  = (x={}) => ({ background:`linear-gradient(135deg,${C.orange},${C.orangeLight})`, color:'#fff', border:'none', borderRadius:10, padding:'11px 22px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 20px ${C.orangeGlow}`, ...x })
const btnGhost   = (x={}) => ({ background:'transparent', color:C.textMuted, border:`1.5px solid ${C.border}`, borderRadius:10, padding:'10px 20px', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit', ...x })
const btnDanger  = (x={}) => ({ background:'rgba(231,76,60,0.1)', color:'#e74c3c', border:'1.5px solid rgba(231,76,60,0.3)', borderRadius:10, padding:'10px 20px', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit', ...x })
const inputStyle = { background:'rgba(255,255,255,0.05)', border:`1.5px solid ${C.border}`, borderRadius:10, padding:'11px 15px', color:C.text, fontSize:15, fontFamily:'inherit', outline:'none', width:'100%' }
const pageStyle  = { maxWidth:980, margin:'0 auto', padding:'24px 16px' }
const secTitle   = { fontSize:17, fontWeight:700, color:C.orange, margin:'0 0 14px', display:'flex', alignItems:'center', gap:8 }

// ─── SMALL COMPONENTS ────────────────────────────────────
function NavBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:'7px 13px', borderRadius:8, cursor:'pointer', fontSize:12, border:active?`1px solid ${C.borderAccent}`:'1px solid transparent', fontWeight:active?700:400, background:active?C.orangeDim:'transparent', color:active?C.orangeLight:C.textMuted, fontFamily:'inherit', whiteSpace:'nowrap', transition:'all 0.18s' }}>{children}</button>
  )
}
function Badge({ label, color }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:color+'18', color, border:`1px solid ${color}44` }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }}/>
      {label}
    </span>
  )
}
function Pill({ active, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{ padding:'4px 11px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit', border:`1.5px solid ${active?(color||C.orange):C.border}`, background:active?(color?color+'15':C.orangeDim):'transparent', color:active?(color||C.orangeLight):C.textMuted, fontWeight:active?700:400, transition:'all 0.15s' }}>{children}</button>
  )
}
function SyncDot({ syncing }) {
  return (
    <span style={{ width:7, height:7, borderRadius:'50%', display:'inline-block', background:syncing?'#f59e0b':C.green, boxShadow:syncing?'0 0 8px #f59e0b':`0 0 6px ${C.green}`, animation:syncing?'pulse 0.8s infinite':'none', marginRight:5 }}/>
  )
}

// ─── PAGE: TOP ───────────────────────────────────────────
function TopPage({ state, setPage, syncing, lastSync, onRefresh }) {
  const stats = computeStats(state.participants)
  const { odds, totalPool, netPool } = computeOdds(stats, state.settings.feeRate)
  const topTeams = [...TEAMS].filter(t=>stats[t.id].lots>0).sort((a,b)=>stats[b.id].amount-stats[a.id].amount).slice(0,5)
  const statusMap = { open:['受付中',C.green], closed:['締切済み',C.red], finished:['結果確定',C.orange] }
  const [statusLabel, statusColor] = statusMap[state.status]||['—','#888']
  const timeStr = lastSync ? lastSync.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'

  return (
    <div style={pageStyle}>
      {/* HERO */}
      <div style={{ position:'relative', overflow:'hidden', background:'linear-gradient(135deg,#0e0f12 0%,#171a20 60%,#0e0f12 100%)', border:`1px solid ${C.borderAccent}`, borderRadius:22, padding:'32px 24px 28px', marginBottom:18, textAlign:'center' }}>
        <div style={{ position:'absolute', left:'50%', top:-40, transform:'translateX(-50%)', width:300, height:160, background:`radial-gradient(ellipse,${C.orangeGlow} 0%,transparent 70%)` }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:11, letterSpacing:'0.25em', color:C.textFaint, marginBottom:10 }}>FIFA</div>
          <div style={{ fontFamily:"'Bebas Neue',cursive", fontSize:'clamp(30px,7vw,58px)', letterSpacing:'0.1em', background:`linear-gradient(135deg,#fff 0%,${C.orangeLight} 50%,#fff 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1, marginBottom:4 }}>
            WORLD CUP 2026
          </div>
          <div style={{ fontSize:13, color:C.textMuted, marginBottom:16 }}>友達と楽しむ優勝予想アプリ</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', alignItems:'center' }}>
            <Badge label={statusLabel} color={statusColor} />
            <span style={{ fontSize:12, color:C.textFaint, lineHeight:'22px' }}>
              総額 <strong style={{ color:C.orangeLight }}>{fmt(totalPool)}</strong>
            </span>
          </div>
          <div style={{ marginTop:10, display:'flex', justifyContent:'center', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:11, color:C.textFaint, display:'flex', alignItems:'center' }}>
              <SyncDot syncing={syncing}/>{syncing?'同期中…':`最終同期 ${timeStr}`}
            </span>
            <button onClick={onRefresh} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, color:C.textFaint, cursor:'pointer', fontSize:11, padding:'2px 8px', fontFamily:'inherit' }}>🔄 更新</button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:18 }}>
        {[['👥','参加者',state.participants.length+'人'],['🎯','総口数',Object.values(stats).reduce((a,s)=>a+s.lots,0)+'口'],['💰','総投票額',fmt(totalPool)],['✨','純分配額',fmt(netPool)]].map(([icon,label,value])=>(
          <div key={label} style={{ ...card(), padding:'14px 12px', textAlign:'center', marginBottom:0 }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
            <div style={{ fontSize:11, color:C.textFaint, marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.orangeLight }}>{value}</div>
          </div>
        ))}
      </div>

      {/* POPULAR */}
      {topTeams.length > 0 && (
        <div style={card()}>
          <div style={secTitle}>🔥 人気上位チーム</div>
          {topTeams.map((team,i) => {
            const ts=stats[team.id]; const pct=totalPool>0?ts.amount/totalPool*100:0; const isJPN=team.id==='JPN'
            return (
              <div key={team.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i<topTeams.length-1?12:0 }}>
                <div style={{ fontSize:15, minWidth:24, textAlign:'center' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</div>
                <span style={{ fontSize:24 }}>{team.flag}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:5, color:isJPN?'#4a9eff':C.text }}>{team.name}</div>
                  <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:4, background:isJPN?'linear-gradient(90deg,#4a9eff,#74b9ff)':i===0?`linear-gradient(90deg,${C.orange},${C.orangeLight})`:'rgba(255,255,255,0.25)' }}/>
                  </div>
                </div>
                <div style={{ textAlign:'right', minWidth:70 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.orangeLight }}>{pct.toFixed(1)}%</div>
                  <div style={{ fontSize:11, color:C.textFaint }}>{odds[team.id]?fmtOdds(odds[team.id]):'—'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {state.status==='open' && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button style={btnOrange({flex:1,padding:14,fontSize:15})} onClick={()=>setPage('register')}>➕ 参加・投票する</button>
          <button style={btnGhost({flex:1,padding:14,fontSize:15})} onClick={()=>setPage('status')}>📊 投票状況を見る</button>
        </div>
      )}
      {state.status==='finished' && (
        <button style={btnOrange({width:'100%',padding:16,fontSize:16})} onClick={()=>setPage('result')}>🏆 結果・受取額を確認</button>
      )}
    </div>
  )
}

// ─── PAGE: REGISTER ──────────────────────────────────────
function RegisterPage({ state, setState }) {
  const [name,setName]=useState('')
  const [step,setStep]=useState('name')
  const [participant,setParticipant]=useState(null)
  const [bets,setBets]=useState([])
  const [filter,setFilter]=useState('全て')
  const [showExisting,setShowExisting]=useState(false)
  const [editMode,setEditMode]=useState(false)
  const [saving,setSaving]=useState(false)

  const handleStart=()=>{
    const n=name.trim(); if(!n) return
    const existing=state.participants.find(p=>p.name===n)
    if(existing){ setParticipant(existing); setBets(existing.bets.map(b=>({teamId:b.teamId,lots:b.lots}))); setEditMode(true) }
    else { setParticipant({id:Date.now().toString(),name:n,bets:[]}); setBets([]); setEditMode(false) }
    setStep('bet')
  }
  const toggleTeam=(teamId)=>setBets(prev=>prev.find(b=>b.teamId===teamId)?prev.filter(b=>b.teamId!==teamId):[...prev,{teamId,lots:1}])
  const setLots=(teamId,lots)=>setBets(prev=>prev.map(b=>b.teamId===teamId?{...b,lots}:b))
  const totalAmount=bets.reduce((a,b)=>a+b.lots*state.settings.unit,0)

  const handleSave=async()=>{
    setSaving(true)
    const finalBets=bets.map(b=>({teamId:b.teamId,lots:b.lots,amount:b.lots*state.settings.unit}))
    const newP={...participant,bets:finalBets}
    await setState(s=>({...s,participants:s.participants.find(p=>p.id===newP.id)?s.participants.map(p=>p.id===newP.id?newP:p):[...s.participants,newP]}))
    setSaving(false); setStep('done')
  }

  const regions=['全て',...Array.from(new Set(TEAMS.map(t=>t.region)))]
  const filteredTeams=filter==='全て'?TEAMS:TEAMS.filter(t=>t.region===filter)

  if(step==='done') return (
    <div style={{...pageStyle,textAlign:'center'}}>
      <div style={{fontSize:60,marginBottom:16}}>✅</div>
      <h2 style={{color:C.orange,margin:'0 0 8px',fontSize:22}}>{editMode?'投票を更新しました！':'投票完了！'}</h2>
      <p style={{color:C.textMuted,margin:'0 0 28px'}}>{participant?.name} さんの投票が全員と共有されました🎉</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <button style={btnOrange()} onClick={()=>{setStep('name');setName('');setBets([])}}>別の参加者を登録</button>
        <button style={btnGhost()} onClick={()=>{setStep('name');setName('');setBets([])}}>トップへ戻る</button>
      </div>
    </div>
  )

  if(step==='name') return (
    <div style={pageStyle}>
      <div style={secTitle}>👤 参加者登録</div>
      <div style={card()}>
        <label style={{fontSize:12,color:C.textMuted,display:'block',marginBottom:6}}>お名前</label>
        <input style={inputStyle} placeholder="例: 田中" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleStart()} autoFocus/>
        <div style={{fontSize:11,color:C.textFaint,marginTop:6}}>※ 登録済みの名前を入力すると投票内容を編集できます</div>
        <button style={btnOrange({marginTop:14,width:'100%',padding:'13px'})} onClick={handleStart}>投票画面へ進む →</button>
      </div>
      {state.participants.length>0&&(
        <div style={card()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{fontWeight:600,fontSize:14}}>参加済み ({state.participants.length}人)</span>
            <button style={btnGhost({padding:'5px 12px',fontSize:11})} onClick={()=>setShowExisting(!showExisting)}>{showExisting?'隠す':'一覧表示'}</button>
          </div>
          {showExisting&&state.participants.map(p=>(
            <div key={p.id} onClick={()=>setName(p.name)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
              <div><div style={{fontWeight:600,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:C.textFaint}}>{p.bets.length}か国 / {fmt(p.bets.reduce((a,b)=>a+b.amount,0))}</div></div>
              <div style={{display:'flex',gap:3}}>
                {p.bets.slice(0,4).map(b=><span key={b.teamId} style={{fontSize:16}}>{TEAMS.find(t=>t.id===b.teamId)?.flag}</span>)}
                {p.bets.length>4&&<span style={{fontSize:11,color:C.textFaint}}>+{p.bets.length-4}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={pageStyle}>
      <div style={secTitle}>⚽ {participant?.name} さんの投票</div>
      <div style={{...card(),background:C.orangeDim,border:`1px solid ${C.borderAccent}`,padding:'14px 18px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          {[['1口単価',fmt(state.settings.unit)],['選択中',bets.length+'か国'],['合計投票額',fmt(totalAmount)]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:11,color:C.textFaint}}>{l}</div><div style={{fontWeight:700,fontSize:l==='合計投票額'?19:15,color:l==='合計投票額'?C.orangeLight:C.text}}>{v}</div></div>
          ))}
        </div>
      </div>
      {bets.length>0&&(
        <div style={{...card(),marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:13,color:C.textMuted,marginBottom:10}}>選択中の国と口数</div>
          {bets.map(b=>{
            const team=TEAMS.find(t=>t.id===b.teamId)
            return(
              <div key={b.teamId} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:20}}>{team?.flag}</span>
                <span style={{flex:1,fontSize:13}}>{team?.name}</span>
                <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {LOTS_OPTIONS.map(lot=><button key={lot} onClick={()=>setLots(b.teamId,lot)} style={{padding:'3px 7px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontFamily:'inherit',background:b.lots===lot?C.orange:'rgba(255,255,255,0.06)',color:b.lots===lot?'#fff':C.textMuted,fontWeight:b.lots===lot?700:400,minWidth:28}}>{lot}口</button>)}
                  </div>
                </div>
                <div style={{fontSize:12,color:C.orangeLight,minWidth:80,textAlign:'right'}}>{fmt(b.lots*state.settings.unit)}</div>
                <button onClick={()=>toggleTeam(b.teamId)} style={{background:'rgba(231,76,60,0.15)',border:'none',borderRadius:6,color:C.red,cursor:'pointer',padding:'3px 7px',fontSize:12}}>✕</button>
              </div>
            )
          })}
        </div>
      )}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
        {regions.map(r=><Pill key={r} active={filter===r} onClick={()=>setFilter(r)} color={r!=='全て'?REGION_COLOR[r]:null}>{r}</Pill>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(85px,1fr))',gap:7,marginBottom:20}}>
        {filteredTeams.map(team=>{
          const bet=bets.find(b=>b.teamId===team.id); const selected=!!bet; const isJPN=team.id==='JPN'
          return(
            <div key={team.id} onClick={()=>toggleTeam(team.id)} style={{background:selected?(isJPN?'rgba(74,158,255,0.15)':C.orangeDim):C.surface,border:`2px solid ${selected?(isJPN?'#4a9eff':C.orange):C.border}`,borderRadius:12,padding:'9px 5px',cursor:'pointer',textAlign:'center',boxShadow:selected?`0 0 14px ${isJPN?'rgba(74,158,255,0.2)':C.orangeGlow}`:'none',transition:'all 0.15s'}}>
              <div style={{fontSize:24}}>{team.flag}</div>
              <div style={{fontSize:10,marginTop:4,lineHeight:1.3,color:isJPN?'#4a9eff':selected?C.orangeLight:C.textMuted,fontWeight:isJPN?700:400}}>{team.name}</div>
              {selected&&<div style={{fontSize:10,color:isJPN?'#4a9eff':C.orange,fontWeight:700,marginTop:2}}>{bet.lots}口</div>}
              <div style={{fontSize:9,color:REGION_COLOR[team.region],marginTop:2}}>{team.region}</div>
            </div>
          )
        })}
      </div>
      <div style={{display:'flex',gap:10}}>
        <button style={btnGhost({flex:1})} onClick={()=>setStep('name')}>← 戻る</button>
        <button style={btnOrange({flex:2,fontSize:15,padding:14,opacity:saving||bets.length===0?0.6:1})} disabled={bets.length===0||saving} onClick={handleSave}>
          {saving?'保存・共有中…':(editMode?'投票を更新する':'投票を確定する')+` — ${fmt(totalAmount)}`}
        </button>
      </div>
    </div>
  )
}

// ─── PAGE: STATUS ────────────────────────────────────────
function StatusPage({ state }) {
  const stats=computeStats(state.participants)
  const {odds,totalPool}=computeOdds(stats,state.settings.feeRate)
  const [view,setView]=useState('team')
  const [sortBy,setSortBy]=useState('amount')
  const [regionFilter,setRegionFilter]=useState('全て')
  const active=TEAMS.filter(t=>stats[t.id].lots>0)
  const sorted=[...active].sort((a,b)=>sortBy==='amount'?stats[b.id].amount-stats[a.id].amount:sortBy==='lots'?stats[b.id].lots-stats[a.id].lots:(odds[b.id]||0)-(odds[a.id]||0))
  const filtered=regionFilter==='全て'?sorted:sorted.filter(t=>t.region===regionFilter)
  const regions=['全て',...Array.from(new Set(TEAMS.map(t=>t.region)))]

  return (
    <div style={pageStyle}>
      <div style={secTitle}>📊 投票状況一覧</div>
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        <NavBtn active={view==='team'} onClick={()=>setView('team')}>🌍 国別</NavBtn>
        <NavBtn active={view==='person'} onClick={()=>setView('person')}>👥 参加者別</NavBtn>
      </div>
      {view==='team'&&(
        <>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
            <span style={{fontSize:11,color:C.textFaint}}>並び:</span>
            {[['amount','投票額'],['lots','口数'],['odds','倍率']].map(([k,l])=><NavBtn key={k} active={sortBy===k} onClick={()=>setSortBy(k)}>{l}</NavBtn>)}
            <span style={{marginLeft:4,fontSize:11,color:C.textFaint}}>地域:</span>
            {regions.map(r=><Pill key={r} active={regionFilter===r} onClick={()=>setRegionFilter(r)} color={r!=='全て'?REGION_COLOR[r]:null}>{r}</Pill>)}
          </div>
          <div style={{fontSize:12,color:C.textFaint,marginBottom:10}}>{filtered.length}か国が投票済み</div>
          {filtered.map((team,i)=>{
            const ts=stats[team.id]; const pct=totalPool>0?ts.amount/totalPool*100:0; const isJPN=team.id==='JPN'
            return(
              <div key={team.id} style={{...card(),border:isJPN?'1px solid rgba(74,158,255,0.3)':`1px solid ${C.border}`,background:isJPN?'rgba(74,158,255,0.04)':C.surface,padding:'14px 16px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{fontSize:12,color:C.textFaint,minWidth:20}}>{i+1}.</div>
                  <span style={{fontSize:26}}>{team.flag}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,fontSize:14,color:isJPN?'#4a9eff':C.text}}>{team.name}</span>
                      <span style={{fontSize:11,color:REGION_COLOR[team.region]}}>{team.region}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginTop:8}}>
                      {[['参加',ts.voters+'人'],['口数',ts.lots+'口'],['投票額',fmt(ts.amount)],['倍率',odds[team.id]?fmtOdds(odds[team.id]):'—']].map(([l,v])=>(
                        <div key={l} style={{textAlign:'center'}}>
                          <div style={{fontSize:9,color:C.textFaint}}>{l}</div>
                          <div style={{fontSize:12,fontWeight:700,color:l==='倍率'?C.green:l==='投票額'?C.orangeLight:C.text}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,height:5,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,borderRadius:3,background:isJPN?'linear-gradient(90deg,#4a9eff,#74b9ff)':`linear-gradient(90deg,${C.orange},${C.orangeLight})`}}/>
                    </div>
                  </div>
                </div>
                {ts.names.length>0&&<div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:4}}>{ts.names.map((n,i)=><span key={i} style={{fontSize:11,background:'rgba(255,255,255,0.06)',borderRadius:5,padding:'2px 7px',color:C.textMuted}}>{n}</span>)}</div>}
              </div>
            )
          })}
          {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:C.textFaint}}>まだ投票がありません</div>}
        </>
      )}
      {view==='person'&&(
        <>
          {state.participants.length===0&&<div style={{textAlign:'center',padding:40,color:C.textFaint}}>参加者がいません</div>}
          {state.participants.map(p=>{
            const total=p.bets.reduce((a,b)=>a+b.amount,0)
            return(
              <div key={p.id} style={{...card(),marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div><div style={{fontWeight:700,fontSize:15}}>{p.name}</div><div style={{fontSize:11,color:C.textFaint}}>{p.bets.length}か国 / {p.bets.reduce((a,b)=>a+b.lots,0)}口</div></div>
                  <div style={{color:C.orangeLight,fontWeight:700,fontSize:14}}>{fmt(total)}</div>
                </div>
                {p.bets.map(b=>{
                  const team=TEAMS.find(t=>t.id===b.teamId); const isJPN=b.teamId==='JPN'
                  return(<div key={b.teamId} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 0',borderTop:`1px solid ${C.border}`}}>
                    <span style={{fontSize:18}}>{team?.flag}</span>
                    <span style={{flex:1,fontSize:13,color:isJPN?'#4a9eff':C.text}}>{team?.name}</span>
                    <span style={{fontSize:11,color:C.textFaint}}>{b.lots}口</span>
                    <span style={{fontSize:13,color:C.orangeLight,minWidth:88,textAlign:'right'}}>{fmt(b.amount)}</span>
                    <span style={{fontSize:11,color:C.green,minWidth:44,textAlign:'right'}}>{odds[b.teamId]?fmtOdds(odds[b.teamId]):'—'}</span>
                  </div>)
                })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── PAGE: ODDS ──────────────────────────────────────────
function OddsPage({ state }) {
  const stats=computeStats(state.participants)
  const {odds,totalPool,netPool}=computeOdds(stats,state.settings.feeRate)
  const active=[...TEAMS].filter(t=>stats[t.id].lots>0).sort((a,b)=>(odds[a.id]||999)-(odds[b.id]||999))
  return(
    <div style={pageStyle}>
      <div style={secTitle}>📈 倍率一覧</div>
      <div style={{...card(),background:'rgba(46,204,113,0.05)',border:'1px solid rgba(46,204,113,0.2)',marginBottom:18}}>
        <div style={{fontSize:12,color:C.textFaint,marginBottom:6}}>倍率の計算式</div>
        <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>
          倍率 = 純分配額 ÷ その国への投票額合計<br/>
          手数料率 <strong style={{color:C.orange}}>{state.settings.feeRate}%</strong> 控除後の純分配額: <strong style={{color:C.green}}>{fmt(netPool)}</strong>（総額 {fmt(totalPool)}）
        </div>
      </div>
      {active.map(team=>{
        const o=odds[team.id]||1; const ts=stats[team.id]; const isJPN=team.id==='JPN'
        const oddsColor=o>=10?C.green:o>=5?'#86efac':o>=2?C.orangeLight:C.red
        return(
          <div key={team.id} style={{...card(),border:isJPN?'1px solid rgba(74,158,255,0.3)':`1px solid ${C.border}`,background:isJPN?'rgba(74,158,255,0.04)':C.surface,padding:'13px 16px',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:22}}>{team.flag}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:isJPN?'#4a9eff':C.text}}>{team.name}</div>
                <div style={{fontSize:11,color:C.textFaint}}>{ts.lots}口 / {fmt(ts.amount)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:24,fontWeight:700,color:oddsColor}}>{fmtOdds(o)}</div>
                <div style={{fontSize:10,color:C.textFaint}}>{o>=10?'超高倍率':o>=5?'高倍率':o>=2?'中倍率':'低倍率'}</div>
              </div>
            </div>
          </div>
        )
      })}
      {active.length===0&&<div style={{textAlign:'center',padding:40,color:C.textFaint}}>まだ投票がありません</div>}
    </div>
  )
}

// ─── PAGE: ADMIN ─────────────────────────────────────────
function AdminPage({ state, setState }) {
  const [pass,setPass]=useState('')
  const [auth,setAuth]=useState(false)
  const [tab,setTab]=useState('settings')
  const [saving,setSaving]=useState(false)
  const stats=computeStats(state.participants)

  const doSet=async(updater)=>{setSaving(true);await setState(updater);setSaving(false)}

  if(!auth) return(
    <div style={{...pageStyle,maxWidth:420}}>
      <div style={secTitle}>🔐 管理者ログイン</div>
      <div style={card()}>
        <label style={{fontSize:12,color:C.textMuted,display:'block',marginBottom:6}}>パスワード</label>
        <input type="password" style={inputStyle} value={pass} onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&(pass===ADMIN_PASS?setAuth(true):alert('パスワードが違います'))} placeholder="パスワードを入力" autoFocus/>
        <button style={btnOrange({marginTop:12,width:'100%'})} onClick={()=>pass===ADMIN_PASS?setAuth(true):alert('パスワードが違います')}>ログイン</button>
      </div>
    </div>
  )

  return(
    <div style={pageStyle}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={secTitle}>⚙️ 管理者画面</div>
        {saving&&<span style={{fontSize:12,color:'#f59e0b'}}>💾 保存・共有中…</span>}
      </div>
      <div style={{display:'flex',gap:5,marginBottom:18,flexWrap:'wrap'}}>
        {[['settings','設定'],['participants','参加者管理'],['winner','優勝国設定']].map(([k,l])=><NavBtn key={k} active={tab===k} onClick={()=>setTab(k)}>{l}</NavBtn>)}
      </div>

      {tab==='settings'&&(
        <>
          <div style={card()}>
            <div style={{fontWeight:600,marginBottom:14,fontSize:14}}>基本設定</div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:C.textMuted,display:'block',marginBottom:8}}>1口単価 (VND)</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {UNIT_OPTIONS.map(u=><button key={u} onClick={()=>doSet(s=>({...s,settings:{...s.settings,unit:u}}))} style={state.settings.unit===u?btnOrange({padding:'7px 14px',fontSize:12}):btnGhost({padding:'7px 14px',fontSize:12})}>{u.toLocaleString()}</button>)}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:C.textMuted,display:'block',marginBottom:8}}>手数料率</label>
              <div style={{display:'flex',gap:6}}>
                {[0,5,10,15,20].map(r=><button key={r} onClick={()=>doSet(s=>({...s,settings:{...s.settings,feeRate:r}}))} style={state.settings.feeRate===r?btnOrange({padding:'7px 12px',fontSize:12}):btnGhost({padding:'7px 12px',fontSize:12})}>{r}%</button>)}
              </div>
            </div>
            <div>
              <label style={{fontSize:12,color:C.textMuted,display:'block',marginBottom:8}}>投票状態</label>
              <div style={{display:'flex',gap:8}}>
                {[['open','受付中',C.green],['closed','締切',C.red]].map(([v,l,c])=>(
                  <button key={v} onClick={()=>doSet(s=>({...s,status:v}))} style={{padding:'8px 18px',borderRadius:10,border:`2px solid ${state.status===v?c:C.border}`,background:state.status===v?c+'18':'transparent',color:state.status===v?c:C.textMuted,cursor:'pointer',fontFamily:'inherit',fontWeight:state.status===v?700:400,fontSize:13}}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={card()}>
            <div style={{fontWeight:600,marginBottom:12,fontSize:14}}>データ管理</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button style={btnGhost()} onClick={()=>{const{odds}=computeOdds(stats,state.settings.feeRate);exportCSV(state.participants,stats,odds,state.winner,state.settings.feeRate)}}>📥 CSVエクスポート</button>
              <button style={btnDanger()} onClick={async()=>{if(window.confirm('全データをリセットしますか？全員のデータが消えます！')){await setState(INIT_STATE)}}}>🗑 全データリセット</button>
            </div>
          </div>
        </>
      )}

      {tab==='participants'&&(
        <>
          <div style={{fontSize:13,color:C.textMuted,marginBottom:12}}>参加者 {state.participants.length}人</div>
          {state.participants.length===0&&<div style={{textAlign:'center',padding:40,color:C.textFaint}}>参加者なし</div>}
          {state.participants.map(p=>(
            <div key={p.id} style={{...card(),marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{p.name}</div><div style={{fontSize:11,color:C.textFaint}}>合計: {fmt(p.bets.reduce((a,b)=>a+b.amount,0))}</div></div>
                <button style={btnDanger({padding:'5px 10px',fontSize:11})} onClick={()=>{if(window.confirm(`${p.name}さんの投票を削除しますか？`))doSet(s=>({...s,participants:s.participants.filter(x=>x.id!==p.id)}))}}>削除</button>
              </div>
              {p.bets.map(b=>{const team=TEAMS.find(t=>t.id===b.teamId);return(
                <div key={b.teamId} style={{display:'flex',gap:8,alignItems:'center',padding:'5px 0',borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:17}}>{team?.flag}</span><span style={{flex:1,fontSize:12}}>{team?.name}</span>
                  <span style={{fontSize:12,color:C.textFaint}}>{b.lots}口</span><span style={{fontSize:12,color:C.orangeLight}}>{fmt(b.amount)}</span>
                </div>
              )})}
            </div>
          ))}
        </>
      )}

      {tab==='winner'&&(
        <div style={card()}>
          <div style={{fontWeight:600,marginBottom:12,fontSize:14}}>優勝国を選択・確定</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:14}}>選択すると全員に通知され、受取額が自動計算されます。</div>
          {state.winner&&(
            <div style={{...card(),background:C.orangeDim,border:`1px solid ${C.borderAccent}`,textAlign:'center',marginBottom:16,padding:'16px'}}>
              <div style={{fontSize:11,color:C.textFaint}}>現在の優勝国</div>
              <div style={{fontSize:40,margin:'8px 0'}}>{TEAMS.find(t=>t.id===state.winner)?.flag}</div>
              <div style={{fontWeight:700,color:C.orangeLight}}>{TEAMS.find(t=>t.id===state.winner)?.name}</div>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(75px,1fr))',gap:6}}>
            {TEAMS.map(team=>{
              const isJPN=team.id==='JPN'; const isSel=state.winner===team.id
              return(<div key={team.id} onClick={()=>{if(window.confirm(`「${team.name}」を優勝国に確定しますか？`))doSet(s=>({...s,winner:team.id,status:'finished'}))}}
                style={{background:isSel?C.orangeDim:isJPN?'rgba(74,158,255,0.06)':C.surface,border:`2px solid ${isSel?C.orange:isJPN?'rgba(74,158,255,0.3)':C.border}`,borderRadius:10,padding:'8px 4px',cursor:'pointer',textAlign:'center'}}>
                <div style={{fontSize:20}}>{team.flag}</div>
                <div style={{fontSize:9,marginTop:3,lineHeight:1.3,color:isJPN?'#4a9eff':C.textMuted}}>{team.name}</div>
              </div>)
            })}
          </div>
          {state.winner&&<button style={btnDanger({marginTop:14,width:'100%'})} onClick={()=>doSet(s=>({...s,winner:null,status:'closed'}))}>優勝国をリセット</button>}
        </div>
      )}
    </div>
  )
}

// ─── PAGE: RESULT ────────────────────────────────────────
function ResultPage({ state }) {
  const stats=computeStats(state.participants)
  const {odds,totalPool,netPool}=computeOdds(stats,state.settings.feeRate)
  const winnings=state.winner?computeWinnings(state.participants,state.winner,stats,state.settings.feeRate):[]
  const winnerTeam=TEAMS.find(t=>t.id===state.winner)
  const fee=totalPool-netPool

  if(!state.winner) return(
    <div style={{...pageStyle,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>⏳</div>
      <h2 style={{color:C.orange}}>優勝国未確定</h2>
      <p style={{color:C.textMuted}}>管理者が優勝国を設定するまでお待ちください</p>
    </div>
  )

  return(
    <div style={pageStyle}>
      <div style={{textAlign:'center',padding:'32px 16px',background:`radial-gradient(circle at 50% 50%,${C.orangeGlow} 0%,transparent 65%)`,border:`1px solid ${C.borderAccent}`,borderRadius:22,marginBottom:18}}>
        <div style={{fontSize:12,letterSpacing:'0.2em',color:C.textFaint,marginBottom:10}}>🏆 優勝国</div>
        <div style={{fontSize:72,lineHeight:1}}>{winnerTeam?.flag}</div>
        <div style={{fontSize:30,fontWeight:900,color:C.orangeLight,marginTop:10}}>{winnerTeam?.name}</div>
        {winnerTeam?.id==='JPN'&&<div style={{marginTop:8,fontSize:14,color:'#4a9eff'}}>🎊 SAMURAI BLUE 優勝おめでとう！🎊</div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:18}}>
        {[['💰 総投票額',fmt(totalPool),C.text],['🏦 手数料',fmt(fee),C.red],['✅ 純分配額',fmt(netPool),C.green],['🎯 当選者',winnings.length+'人',C.orangeLight]].map(([l,v,c])=>(
          <div key={l} style={{...card(),textAlign:'center',padding:'12px 8px',marginBottom:0}}>
            <div style={{fontSize:11,color:C.textFaint,marginBottom:4}}>{l}</div>
            <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={card()}>
        <div style={secTitle}>🎉 当選者一覧</div>
        {winnings.length===0?<div style={{textAlign:'center',color:C.textFaint,padding:20}}>当選者なし</div>
          :winnings.sort((a,b)=>b.winAmount-a.winAmount).map((w,i)=>(
            <div key={w.name} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0',borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:18,minWidth:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'🎖'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{w.name}</div>
                <div style={{fontSize:11,color:C.textFaint}}>投票額: {fmt(w.betAmount)} / {w.lots}口 / 倍率: {fmtOdds(odds[state.winner]||1)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:17,fontWeight:700,color:C.orangeLight}}>{fmt(w.winAmount)}</div>
                <div style={{fontSize:11,color:w.profit>=0?C.green:C.red}}>{w.profit>=0?'+':''}{fmt(w.profit)}</div>
              </div>
            </div>
          ))
        }
      </div>
      <div style={card()}>
        <div style={secTitle}>📋 全参加者の損益</div>
        {state.participants.map(p=>{
          const w=winnings.find(w=>w.name===p.name); const total=p.bets.reduce((a,b)=>a+b.amount,0)
          return(
            <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
              <div><div style={{fontWeight:600,fontSize:14}}>{p.name} {w?'🏆':''}</div><div style={{fontSize:11,color:C.textFaint}}>投票額: {fmt(total)} / {p.bets.length}か国</div></div>
              <div style={{textAlign:'right'}}>
                {w?(<><div style={{color:C.orangeLight,fontWeight:700}}>{fmt(w.winAmount)}</div><div style={{fontSize:11,color:w.profit>=0?C.green:C.red}}>利益: {w.profit>=0?'+':''}{fmt(w.profit)}</div></>)
                  :<div style={{color:C.red,fontWeight:600}}>−{fmt(total)}</div>}
              </div>
            </div>
          )
        })}
      </div>
      <button style={btnGhost({width:'100%',marginTop:6})} onClick={()=>exportCSV(state.participants,stats,odds,state.winner,state.settings.feeRate)}>📥 結果をCSVで出力</button>
    </div>
  )
}

// ─── MAIN APP ────────────────────────────────────────────
export default function App() {
  const [state,_setState]=useState(INIT_STATE)
  const [page,setPage]=useState('top')
  const [loading,setLoading]=useState(true)
  const [syncing,setSyncing]=useState(false)
  const [lastSync,setLastSync]=useState(null)
  const unsubRef=useRef(null)

  // 初回ロード + リアルタイム購読
  useEffect(()=>{
    ;(async()=>{
      const remote=await dbLoad()
      if(remote) _setState(remote)
      setLoading(false)
      setLastSync(new Date())
    })()
    // Firestoreのリアルタイム更新を購読
    unsubRef.current=dbSubscribe((remote)=>{
      if(remote) _setState(remote)
      setLastSync(new Date())
    })
    return()=>{ if(unsubRef.current) unsubRef.current() }
  },[])

  const onRefresh=async()=>{
    setSyncing(true)
    const remote=await dbLoad()
    if(remote) _setState(remote)
    setLastSync(new Date())
    setSyncing(false)
  }

  // setState: stateRefで確実に最新値を取得してFirestoreへ保存
  const stateRef = useRef(state)
  useEffect(()=>{ stateRef.current = state },[state])

  const setState=useCallback(async(updater)=>{
    setSyncing(true)
    try {
      // updaterで次のstateを計算（stateRefから現在値を取得）
      const prev = stateRef.current
      const next = typeof updater==='function' ? updater(prev) : updater
      // 先にFirestoreへ保存（確実に）
      await dbSave(next)
      // 保存成功後にローカルstateを更新
      _setState(next)
      setLastSync(new Date())
    } catch(e) {
      console.error('dbSave error:', e)
      alert('保存に失敗しました。再度お試しください。')
    } finally {
      setSyncing(false)
    }
  },[])

  const PAGES=[['top','🏠 TOP'],['register','⚽ 投票'],['status','📊 状況'],['odds','📈 倍率'],['result','🏆 結果'],['admin','⚙️ 管理']]

  if(loading) return(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,fontFamily:"'Noto Sans JP',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700;900&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:48,height:48,border:`4px solid rgba(255,107,26,0.2)`,borderTopColor:C.orange,borderRadius:'50%',animation:'spin 0.9s linear infinite'}}/>
      <div style={{color:C.textMuted,fontSize:14}}>データを読み込み中…</div>
    </div>
  )

  return(
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:60}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700;900&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus{border-color:#ff6b1a!important;box-shadow:0 0 0 3px rgba(255,107,26,0.15)!important;}
        button{transition:opacity 0.15s,transform 0.15s;}
        button:active{opacity:0.85;transform:scale(0.98);}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,26,0.25);border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* HEADER */}
      <div style={{background:'rgba(13,15,18,0.95)',borderBottom:`1px solid rgba(255,107,26,0.15)`,padding:'12px 16px',position:'sticky',top:0,zIndex:100,backdropFilter:'blur(16px)'}}>
        <div style={{maxWidth:980,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:'clamp(15px,4vw,22px)',letterSpacing:'0.15em',background:`linear-gradient(90deg,#fff 0%,${C.orangeLight} 60%,#fff 100%)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              ⚽ WORLD CUP 2026 — 優勝予想
            </div>
            <span style={{fontSize:11,color:C.textFaint,display:'flex',alignItems:'center'}}>
              <SyncDot syncing={syncing}/>{syncing?'同期中…':lastSync?`最終同期 ${lastSync.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'—'}
            </span>
          </div>
          <nav style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
            {PAGES.map(([key,label])=><NavBtn key={key} active={page===key} onClick={()=>setPage(key)}>{label}</NavBtn>)}
          </nav>
        </div>
      </div>

      {page==='top'      &&<TopPage      state={state} setPage={setPage} syncing={syncing} lastSync={lastSync} onRefresh={onRefresh}/>}
      {page==='register' &&<RegisterPage state={state} setState={setState}/>}
      {page==='status'   &&<StatusPage   state={state}/>}
      {page==='odds'     &&<OddsPage     state={state}/>}
      {page==='result'   &&<ResultPage   state={state}/>}
      {page==='admin'    &&<AdminPage    state={state} setState={setState}/>}
    </div>
  )
}
