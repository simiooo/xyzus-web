import PlayerWidget from './PlayerWidget'

export default function RightPanel() {
  return (
    <div className="fixed right-6 top-6 w-[300px] bottom-6 overflow-y-auto scrollbar-thin">
      <PlayerWidget />
    </div>
  )
}
