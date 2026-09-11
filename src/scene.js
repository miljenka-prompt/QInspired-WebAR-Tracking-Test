import * as THREE from 'three'

let theropodVideo = null
let theropodPlane = null
let theropodShadow = null
let xrCamera = null

const VIDEO_URL = 'https://miljenka-prompt.github.io/AR-kredna-obala-Istarskog-arhipelaga/Cretaceous_teropod.mp4'

const setStatus = (text) => {
  const status = document.getElementById('status')
  if (status) status.textContent = text
}

const makeSoftShadowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(128, 64, 8, 128, 64, 120)
  gradient.addColorStop(0, 'rgba(0,0,0,0.42)')
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.20)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return new THREE.CanvasTexture(canvas)
}

const makeSpatialVideoMaterial = (texture) => new THREE.ShaderMaterial({
  uniforms: {
    map: {value: texture},
    feather: {value: 0.055},
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform float feather;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(map, vUv);
      float edgeX = smoothstep(0.0, feather, vUv.x) * smoothstep(0.0, feather, 1.0 - vUv.x);
      float edgeY = smoothstep(0.0, feather, vUv.y) * smoothstep(0.0, feather, 1.0 - vUv.y);
      float alpha = edgeX * edgeY;
      gl_FragColor = vec4(c.rgb, c.a * alpha);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  toneMapped: false,
})

const buildTheropodVideoPlane = (scene) => {
  theropodVideo = document.createElement('video')
  theropodVideo.src = VIDEO_URL
  theropodVideo.crossOrigin = 'anonymous'
  theropodVideo.loop = true
  theropodVideo.muted = true
  theropodVideo.playsInline = true
  theropodVideo.setAttribute('playsinline', '')
  theropodVideo.setAttribute('webkit-playsinline', '')
  theropodVideo.preload = 'auto'

  const texture = new THREE.VideoTexture(theropodVideo)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const targetHeight = 1.8
  theropodPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, targetHeight),
    makeSpatialVideoMaterial(texture)
  )
  theropodPlane.name = 'world-locked-cretaceous-theropod-video'
  theropodPlane.position.set(0, targetHeight / 2, -1.5)
  theropodPlane.renderOrder = 2
  scene.add(theropodPlane)

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: makeSoftShadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  theropodShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), shadowMaterial)
  theropodShadow.rotation.x = -Math.PI / 2
  theropodShadow.position.set(0, 0.015, -1.5)
  theropodShadow.renderOrder = 1
  scene.add(theropodShadow)

  theropodVideo.addEventListener('loadedmetadata', () => {
    if (!theropodPlane || !theropodVideo.videoWidth || !theropodVideo.videoHeight) return
    const aspect = theropodVideo.videoWidth / theropodVideo.videoHeight
    const width = targetHeight * aspect
    theropodPlane.geometry.dispose()
    theropodPlane.geometry = new THREE.PlaneGeometry(width, targetHeight)

    if (theropodShadow) {
      theropodShadow.geometry.dispose()
      theropodShadow.geometry = new THREE.PlaneGeometry(Math.max(2.2, width * 0.75), 1.0)
    }

    setStatus('Theropod je usidren. Rubovi su omekšani, a prikaz se okreće prema tebi samo po Y osi.')
  })

  theropodVideo.addEventListener('error', () => {
    setStatus('Video se nije učitao. Tracking je aktivan; pokušaj osvježiti stranicu.')
  })

  theropodVideo.play().catch(() => {
    setStatus('Tracking je aktivan. Dodirni “Pokreni video” za theropoda.')
  })
}

export const toggleTheropodVideo = async () => {
  if (!theropodVideo) return false

  if (theropodVideo.paused) {
    await theropodVideo.play()
    return true
  }

  theropodVideo.pause()
  return false
}

export const initScenePipelineModule = () => ({
  name: 'qinspired-theropod-video-scene',

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

    setStatus('Tracking aktivan. Theropod video se učitava…')
  },

  onUpdate: () => {
    if (!theropodPlane || !xrCamera) return

    const dx = xrCamera.position.x - theropodPlane.position.x
    const dz = xrCamera.position.z - theropodPlane.position.z
    theropodPlane.rotation.y = Math.atan2(dx, dz)
  },
})
