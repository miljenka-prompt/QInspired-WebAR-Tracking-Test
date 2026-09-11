import * as THREE from 'three'

let theropodVideo = null
let theropodMaskVideo = null
let theropodPlane = null
let theropodShadow = null
let xrCamera = null

const VIDEO_URL = './theropod.mp4'
const MASK_URL = './theropod-mask.mp4'

const setStatus = (text) => {
  const status = document.getElementById('status')
  if (status) status.textContent = text
}

const makeVideoElement = (src) => {
  const video = document.createElement('video')
  video.src = src
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'auto'
  return video
}

const makeSoftShadowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(128, 64, 8, 128, 64, 120)
  gradient.addColorStop(0, 'rgba(0,0,0,0.36)')
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.16)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return new THREE.CanvasTexture(canvas)
}

const makeAlphaMaskedMaterial = (rgbTexture, maskTexture) => new THREE.ShaderMaterial({
  uniforms: {
    rgbMap: {value: rgbTexture},
    maskMap: {value: maskTexture},
    alphaGain: {value: 1.15},
    alphaFloor: {value: 0.08},
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D rgbMap;
    uniform sampler2D maskMap;
    uniform float alphaGain;
    uniform float alphaFloor;
    varying vec2 vUv;

    void main() {
      vec4 rgb = texture2D(rgbMap, vUv);
      float m = texture2D(maskMap, vUv).r;
      float a = smoothstep(alphaFloor, 1.0, m * alphaGain);
      if (a < 0.015) discard;
      gl_FragColor = vec4(rgb.rgb, a);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: false,
})

const syncVideos = () => {
  if (!theropodVideo || !theropodMaskVideo) return
  const drift = Math.abs(theropodVideo.currentTime - theropodMaskVideo.currentTime)
  if (drift > 0.08) theropodMaskVideo.currentTime = theropodVideo.currentTime
}

const playBoth = async () => {
  if (!theropodVideo || !theropodMaskVideo) return false
  theropodMaskVideo.currentTime = theropodVideo.currentTime
  await Promise.all([theropodVideo.play(), theropodMaskVideo.play()])
  return true
}

const pauseBoth = () => {
  theropodVideo?.pause()
  theropodMaskVideo?.pause()
}

const buildTheropodVideoPlane = (scene) => {
  theropodVideo = makeVideoElement(VIDEO_URL)
  theropodMaskVideo = makeVideoElement(MASK_URL)

  const rgbTexture = new THREE.VideoTexture(theropodVideo)
  rgbTexture.colorSpace = THREE.SRGBColorSpace
  rgbTexture.minFilter = THREE.LinearFilter
  rgbTexture.magFilter = THREE.LinearFilter
  rgbTexture.generateMipmaps = false

  const maskTexture = new THREE.VideoTexture(theropodMaskVideo)
  maskTexture.colorSpace = THREE.NoColorSpace
  maskTexture.minFilter = THREE.LinearFilter
  maskTexture.magFilter = THREE.LinearFilter
  maskTexture.generateMipmaps = false

  const targetHeight = 1.8
  theropodPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, targetHeight),
    makeAlphaMaskedMaterial(rgbTexture, maskTexture)
  )
  theropodPlane.name = 'world-locked-alpha-masked-theropod'
  theropodPlane.position.set(0, targetHeight / 2, -1.5)
  theropodPlane.renderOrder = 2
  scene.add(theropodPlane)

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: makeSoftShadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  theropodShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.9), shadowMaterial)
  theropodShadow.rotation.x = -Math.PI / 2
  theropodShadow.position.set(0, 0.012, -1.5)
  scene.add(theropodShadow)

  let rgbReady = false
  let maskReady = false

  const maybeReady = () => {
    if (!rgbReady || !maskReady) return

    const aspect = theropodVideo.videoWidth / theropodVideo.videoHeight
    const width = targetHeight * aspect
    theropodPlane.geometry.dispose()
    theropodPlane.geometry = new THREE.PlaneGeometry(width, targetHeight)

    theropodShadow.geometry.dispose()
    theropodShadow.geometry = new THREE.PlaneGeometry(Math.max(2.0, width * 0.72), 0.9)

    setStatus('Alpha mask učitana. U prostoru bi trebao ostati samo theropod, bez video-ekrana.')
    playBoth().catch(() => {
      setStatus('Alpha mask spremna. Dodirni “Pokreni video”.')
    })
  }

  theropodVideo.addEventListener('loadedmetadata', () => {
    rgbReady = true
    maybeReady()
  })

  theropodMaskVideo.addEventListener('loadedmetadata', () => {
    maskReady = true
    maybeReady()
  })

  const handleError = () => {
    setStatus('RGB ili alpha-mask video se nije učitao. Osvježi stranicu nakon deploya.')
  }
  theropodVideo.addEventListener('error', handleError)
  theropodMaskVideo.addEventListener('error', handleError)
}

export const toggleTheropodVideo = async () => {
  if (!theropodVideo || !theropodMaskVideo) return false

  if (theropodVideo.paused) {
    await playBoth()
    return true
  }

  pauseBoth()
  return false
}

export const initScenePipelineModule = () => ({
  name: 'qinspired-alpha-theropod-scene',

  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera

    buildTheropodVideoPlane(scene)

    camera.position.set(0, 1.6, 2.5)

    XR8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })

    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})

    setStatus('Tracking aktivan. Učitavam RGB video i alpha masku…')
  },

  onUpdate: () => {
    if (!theropodPlane || !xrCamera) return

    syncVideos()

    const dx = xrCamera.position.x - theropodPlane.position.x
    const dz = xrCamera.position.z - theropodPlane.position.z
    theropodPlane.rotation.y = Math.atan2(dx, dz)
  },
})
