import { RouterProvider } from 'react-router'
import router from '@/router'
import AudioPlayer from '@/components/AudioPlayer'

export default function App() {
  return (
    <>
      <AudioPlayer />
      <RouterProvider router={router} />
    </>
  )
}
