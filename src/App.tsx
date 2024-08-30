// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import  DemoComponent  from "./components/Demo"
import VideoMain from "./components/VideoPlayer/VideoMain"
import HostSelector from "./components/HostSelector"
import MainController from "./components/MainController"
// import MainControllerSimulator from "./components/MainControlSimulator"
// import './App.css'

function App() {
  // const [count, setCount] = useState(0)

  return (
    <>
      <HostSelector></HostSelector>
      <VideoMain></VideoMain>
      <MainController></MainController>
      {/* <MainControllerSimulator></MainControllerSimulator> */}
      {/* <DemoComponent></DemoComponent> */}
    </>
  )
}

export default App
