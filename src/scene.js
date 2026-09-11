import * as THREE from 'three'

let spatialVideo = null
let spatialMaskVideo = null
let spatialPlane = null
let spatialShadow = null
let xrCamera = null

const SUBJECTS = {
  theropod: {
    label: 'theropod',
    title: 'kredni theropod',
    videoUrl: './theropod.mp4',
    maskUrl: './theropod-mask.mp4',
    targetHeight: 1.8,
    shadowScale: 0.72,
  },
  neanderthal: {
    label: 'neandertalac',
    title: 'krapinski neandertalac',
    videoUrl: './neanderthal.mp4',
    maskUrl: './neanderthal-mask.mp4',
    targetHeight: 1.75,
    shadowScale: 0.55,
  },
}

const params = new URLSearchParams(window.location.search)
const requestedSubject = params.get('subject')
const subjectKey = requestedSubject === 'neanderthal' ? 'neanderthal' : 'theropod'
const subject = SUBJECTS[subjectKey]

export const getSpatialSubject = () => ({key: subjectKey, ...subject})

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
  gradient.addColorStop(0, 'rgba(0,0,0,0.34)')
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.14)')
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
  if (!spatialVideo || !spatialMaskVideo) return
  const drift = Math.abs(spatialVideo.currentTime - spatialMaskVideo.currentTime)
  if (drift > 0.08) spatialMaskVideo.currentTime = spatialVideo.currentTime
}

const playBoth = async () => {
  if (!spatialVideo || !spatialMaskVideo) return false
  spatialMaskVideo.currentTime = spatialVideo.currentTime
  await Promise.all([spatialVideo.play(), spatialMaskVideo.play()])
  return true
}

const pauseBoth = () => {
  spatialVideo?.pause()
  spatialMaskVideo?.pause()
}

const buildSpatialVideoPlane = (scene) => {
  spatialVideo = makeVideoElement(subject.videoUrl)
  spatialMaskVideo = makeVideoElement(subject.maskUrl)

  const rgbTexture = new THREE.VideoTexture(spatialVideo)
  rgbTexture.colorSpace = THREE.SRGBColorSpace
  rgbTexture.minFilter = THREE.LinearFilter
  rgbTexture.magFilter = THREE.LinearFilter
  rgbTexture.generateMipmaps = false

  const maskTexture = new THREE.VideoTexture(spatialMaskVideo)
  maskTexture.colorSpace = THREE.NoColorSpace
  maskTexture.minFilter = THREE.LinearFilter
  maskTexture.magFilter = THREE.LinearFilter
  maskTexture.generateMipmaps = false

  spatialPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, subject.targetHeight),
    makeAlphaMaskedMaterial(rgbTexture, maskTexture)
  )
  spatialPlane.name = `world-locked-alpha-masked-${subjectKey}`
  spatialPlane.position.set(0, subject.targetHeight / 2, -1.5)
  spatialPlane.renderOrder = 2
  scene.add(spatialPlane)

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: makeSoftShadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  spatialShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.85), shadowMaterial)
  spatialShadow.rotation.x = -Math.PI / 2
  spatialShadow.position.set(0, 0.012, -1.5)
  scene.add(spatialShadow)

  let rgbReady = false
  let maskReady = false

  const maybeReady = () => {
    if (!rgbReady || !maskReady) return

    const aspect = spatialVideo.videoWidth / spatialVideo.videoHeight
    const width = subject.targetHeight * aspect
    spatialPlane.geometry.dispose()
    spatialPlane.geometry = new THREE.PlaneGeometry(width, subject.targetHeight)

    spatialShadow.geometry.dispose()
    spatialShadow.geometry = new THREE.PlaneGeometry(Math.max(1.4, width * subject.shadowScale), 0.85)

    setStatus(`Alpha mask učitana. U prostoru bi trebao ostati samo ${subject.label}, bez video-ekrana.`)
    playBoth().catch(() => {
      setStatus(`Alpha mask spremna. Dodirni “Pokreni video” za ${subject.label}.`)
    })
  }

  spatialVideo.addEventListener('loadedmetadata', () => {
    rgbReady = true
    maybeReady()
  })

  spatialMaskVideo.addEventListener('loadedmetadata', () => {
    maskReady = true
    maybeReady()
  })

  const handleError = () => {
    setStatus('RGB ili alpha-mask video se nije učitao. Osvježi stranicu nakon deploya.')
  }
  spatialVideo.addEventListener('error', handleError)
  spatialMaskVideo.addEventListener('error', handleError)
}

export const toggleSpatialVideo = async () => {
  if (!spatialVideo || !spatialMaskVideo) return false

  if (spatialVideo.paused) {
    await playBoth()
    return true
  }

  pauseBoth()
  return false
}

export const initScenePipelineModule = () => ({
  name: `qinspired-alpha-${subjectKey}-scene`,

  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera

    buildSpatialVideoPlane(scene)

    camera.position.set(0, 1.6, 2.5)

    XR8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })

    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})

    setStatus(`Tracking aktivan. Učitavam ${subject.title} i alpha masku…`)
  },

  onUpdate: () => {
    if (!spatialPlane || !xrCamera) return

    syncVideos()

    const dx = xrCamera.position.x - spatialPlane.position.x
    const dz = xrCamera.position.z - spatialPlane.position.z
    spatialPlane.rotation.y = Math.atan2(dx, dz)
  },
})
