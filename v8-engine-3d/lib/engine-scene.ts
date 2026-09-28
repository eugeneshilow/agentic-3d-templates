import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// The whole engine: geometry, materials, kinematics, charts and the overlay
// wiring. Ported line by line from the single-file original (index.html built
// by Codex): the same parts, the same numbers, the same timing. What changed:
// three.js comes from npm instead of a CDN, the copy is English, DOM lookups
// are scoped to the component root, and initEngineScene() returns a dispose
// function for React unmounts. All geometry, textures and lighting are
// procedural: no models, no images.

type Mode = 'assembled' | 'cutaway' | 'exploded' | 'single'
type CameraName = 'general' | 'front' | 'side' | 'top' | 'cylinder'
type Vec2 = [number, number]
type Vec3 = [number, number, number]

declare global {
  interface Window {
    // Read-only diagnostics for automated browser checks (see README).
    __V8?: Record<string, unknown>
  }
}

export function initEngineScene(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = []
  // Every listener goes through here, so dispose() can take it off again.
  const listen = (target: EventTarget, type: string, handler: (event: never) => void) => {
    const fn = handler as unknown as EventListener
    target.addEventListener(type, fn)
    cleanups.push(() => target.removeEventListener(type, fn))
  }
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = root.querySelector<T>(`#${id}`)
    if (!el) throw new Error(`Scene markup is missing #${id}`)
    return el
  }
  const mobileQuery = matchMedia('(max-width: 760px)')
  const telemetry = $<HTMLDetailsElement>('telemetry')
  const helpDialog = $<HTMLDialogElement>('help-dialog')
  telemetry.open = !mobileQuery.matches
  listen(mobileQuery, 'change', () => {
    telemetry.open = !mobileQuery.matches
  })
  listen($('help'), 'click', () => helpDialog.showModal())
  listen($('close-help'), 'click', () => helpDialog.close())
  listen(helpDialog, 'click', (e: MouseEvent) => {
    if (e.target === helpDialog) {
      const r = helpDialog.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        helpDialog.close()
    }
  })
  listen($('retry'), 'click', () => location.reload())
  function fail(message: string) {
    $('loading').classList.remove('hidden')
    $('loading-text').textContent = message
    $('loading-line').style.display = 'none'
    $('retry').style.display = 'block'
  }
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  function toast(message: string) {
    $('notice').textContent = message
    $('notice').classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => $('notice').classList.remove('show'), 2600)
  }
  cleanups.push(() => clearTimeout(toastTimer))
  try {
    const TAU = Math.PI * 2,
      DEG = Math.PI / 180,
      Y = new THREE.Vector3(0, 1, 0)
    const order = [1, 8, 4, 3, 6, 5, 7, 2],
      pinOffsets = [45, 135, -45, 225]
    const R = 0.62,
      L = 1.85,
      spacing = 1.39
    const state = {
      angle: 28,
      rpm: 1200,
      playing: true,
      timeScale: 0.05,
      mode: 'cutaway' as Mode,
      selected: 1,
      auto: false,
      autoElapsed: 0,
      explode: 0,
      camera: 'general' as CameraName,
    }
    const phaseNames = ['Intake', 'Compression', 'Power', 'Exhaust']
    const phaseColors = ['#75b6df', '#e1bd67', '#fa634b', '#9aa5af']
    const phaseDescriptions = [
      'The air-fuel mixture flows in\nthrough the open intake valve.',
      'The piston compresses the mixture.\nBoth valves are closed.',
      'Combustion energy turns\ninto crankshaft rotation.',
      'The piston pushes the gases out\nthrough the exhaust valve.',
    ]
    const mod = (x: number, n: number) => ((x % n) + n) % n
    function cycleFor(id: number, angle = state.angle) {
      return mod(angle - order.indexOf(id) * 90 + 360, 720)
    }
    function valveLift(cycle: number, exhaust = false) {
      const start = exhaust ? 526 : 710,
        duration = exhaust ? 208 : 208
      const t = mod(cycle - start, 720) / duration
      return t < 1 ? Math.pow(Math.sin(Math.PI * t), 2) * 0.215 : 0
    }
    function pistonTravel(relativeAngle: number) {
      const a = relativeAngle * DEG
      return R * Math.cos(a) + Math.sqrt(L * L - R * R * Math.sin(a) ** 2)
    }
    function pressure(cycle: number) {
      const volume = 1 + (9.5 * (L + R - pistonTravel(cycle))) / (2 * R)
      if (cycle < 180) return 0.92
      if (cycle < 360) return Math.pow(10.5 / volume, 1.28) * 0.92
      if (cycle < 540)
        return (42 + 10 * Math.exp(-(((cycle - 373) / 14) ** 2))) / Math.pow(volume, 1.16)
      return 1.08 + 1.5 * Math.exp(-(cycle - 540) / 14)
    }
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobileQuery.matches ? 1.5 : 1.75))
    renderer.setSize(innerWidth, innerHeight)
    renderer.setClearColor(0x111316)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    $('viewport').appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x111316, 0.028)
    const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 100)
    camera.position.set(10, 7.3, 11.8)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.target.set(0, 1.25, 0)
    controls.enablePan = true
    controls.minDistance = 4
    controls.maxDistance = 27
    controls.maxPolarAngle = Math.PI * 0.82
    const envScene = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(envScene, 0.04)
    scene.environment = envTarget.texture
    envScene.dispose()
    pmrem.dispose()
    scene.add(new THREE.HemisphereLight(0xc7d8eb, 0x34302a, 1.9))
    const key = new THREE.DirectionalLight(0xffebd5, 4.1)
    key.position.set(4, 9, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 })
    key.shadow.bias = -0.0007
    key.shadow.normalBias = 0.045
    key.shadow.radius = 3
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xaec9e2, 3.4)
    rim.position.set(-5, 5, -5)
    scene.add(rim)
    const frontLight = new THREE.DirectionalLight(0xf0c19b, 1.5)
    frontLight.position.set(1, 3, 8)
    scene.add(frontLight)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9, metalness: 0.12 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.18
    ground.receiveShadow = true
    scene.add(ground)
    // A generated radial contact shadow keeps the engine grounded without postprocessing.
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 128
    const sc = shadowCanvas.getContext('2d')!

    const sg = sc.createRadialGradient(64, 64, 10, 64, 64, 64)
    sg.addColorStop(0, 'rgba(0,0,0,.7)')
    sg.addColorStop(0.5, 'rgba(0,0,0,.36)')
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    sc.fillStyle = sg
    sc.fillRect(0, 0, 128, 128)
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 10),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      })
    )
    contact.rotation.x = -Math.PI / 2
    contact.position.y = -1.17
    scene.add(contact)
    const engine = new THREE.Group()
    scene.add(engine)
    const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.015)
    const mat = (color: number, metalness = 0.85, roughness = 0.28) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 1.25 })
    const materials = {
      block: mat(0x343b40, 0.83, 0.32),
      edge: mat(0x697278, 0.9, 0.27),
      silver: mat(0xc5cbd0, 0.92, 0.23),
      steel: mat(0x69727b, 0.95, 0.23),
      dark: mat(0x22272d, 0.8, 0.35),
      brass: mat(0xc6a16c, 0.82, 0.28),
      copper: mat(0x9e6146, 0.8, 0.3),
      red: mat(0x8d3023, 0.7, 0.32),
      ceramic: mat(0xe8e6db, 0.12, 0.23),
      rubber: mat(0x242729, 0.1, 0.8),
      cut: mat(0xc08c55, 0.75, 0.34),
    }
    const blockMat = materials.block.clone()
    blockMat.side = THREE.DoubleSide
    blockMat.clipShadows = true
    const blockEdge = materials.edge.clone()
    blockEdge.side = THREE.DoubleSide
    blockEdge.clipShadows = true
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xc0dded,
      metalness: 0.05,
      roughness: 0.13,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.7,
    })
    type Material = THREE.Material
    const geometryCache = new Map<string, THREE.BufferGeometry>()
    function geo(key: string, fn: () => THREE.BufferGeometry) {
      if (!geometryCache.has(key)) geometryCache.set(key, fn())
      return geometryCache.get(key)!
    }
    function mesh<M extends Material>(
      parent: THREE.Object3D,
      g: THREE.BufferGeometry,
      m: M,
      x = 0,
      y = 0,
      z = 0
    ) {
      const a = new THREE.Mesh<THREE.BufferGeometry, M>(g, m)
      a.position.set(x, y, z)
      a.castShadow = !m.transparent
      a.receiveShadow = !m.transparent
      parent.add(a)
      return a
    }
    function box<M extends Material>(
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      m: M,
      x = 0,
      y = 0,
      z = 0
    ) {
      return mesh(
        parent,
        geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
        m,
        x,
        y,
        z
      )
    }
    function cyl<M extends Material>(
      parent: THREE.Object3D,
      r: number,
      h: number,
      m: M,
      x = 0,
      y = 0,
      z = 0,
      segments = 32
    ) {
      return mesh(
        parent,
        geo(`c${r},${h},${segments}`, () => new THREE.CylinderGeometry(r, r, h, segments)),
        m,
        x,
        y,
        z
      )
    }
    function torus(parent: THREE.Object3D, r: number, t: number, m: Material, x = 0, y = 0, z = 0) {
      const a = mesh(
        parent,
        geo(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 6, 40)),
        m,
        x,
        y,
        z
      )
      a.rotation.x = Math.PI / 2
      return a
    }
    function shaft(
      parent: THREE.Object3D,
      r: number,
      len: number,
      m: Material,
      x = 0,
      y = 0,
      z = 0
    ) {
      const a = cyl(parent, r, len, m, x, y, z)
      a.rotation.x = Math.PI / 2
      return a
    }
    function bolt(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1) {
      const a = cyl(parent, 0.066 * scale, 0.055 * scale, materials.silver, x, y, z, 6)
      return a
    }
    // Merge only local static parts: animation groups and per-cylinder materials stay independent.
    function mergeStatic(group: THREE.Object3D) {
      const byMat = new Map<
        string,
        { material: Material; geometries: THREE.BufferGeometry[]; shadow: boolean }
      >()
      group.updateMatrixWorld(true)
      for (const object of [...group.children]) {
        const child = object as THREE.Mesh<THREE.BufferGeometry, Material>
        if (child.isMesh && !child.userData.keep) {
          child.updateMatrix()
          const g = (
            child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
          ).applyMatrix4(child.matrix)
          const key = child.material.uuid
          if (!byMat.has(key))
            byMat.set(key, { material: child.material, geometries: [], shadow: child.castShadow })
          byMat.get(key)!.geometries.push(g)
          group.remove(child)
        }
      }
      for (const item of byMat.values()) {
        const g = mergeGeometries(item.geometries)
        item.geometries.forEach((a) => a.dispose())
        if (!g) throw new Error('Could not merge the engine geometry')
        const a = mesh(group, g, item.material)
        a.castShadow = item.shadow
      }
    }
    const housing = new THREE.Group()
    engine.add(housing)
    box(housing, 2.04, 0.36, 6.25, blockMat, 0, -0.8, 0)
    box(housing, 1.65, 0.15, 5.9, blockMat, 0, -1.035, 0)
    for (const s of [-1, 1]) {
      box(housing, 0.15, 0.58, 6.25, blockMat, s * 0.95, -0.33, 0)
      for (let j = 0; j < 6; j++)
        box(housing, 0.07, 0.04, 6.15, blockEdge, s * 1.035, -0.6 + j * 0.105, 0)
      for (let j = 0; j < 9; j++)
        bolt(housing, s * 0.83, -0.59, -2.82 + j * 0.7).material = blockEdge
    }
    for (let j = 0; j < 5; j++) {
      const z = (j - 2) * spacing
      box(housing, 1.86, 0.23, 0.23, blockMat, 0, -0.07, z)
      shaft(housing, 0.32, 0.27, materials.brass, 0, 0, z)
    }
    mergeStatic(housing)
    const crank = new THREE.Group()
    engine.add(crank)
    shaft(crank, 0.18, 7.3, materials.steel)
    const pins: Array<{ x: number; y: number; z: number }> = []
    for (let i = 0; i < 4; i++) {
      const z = (1.5 - i) * spacing,
        a = pinOffsets[i] * DEG,
        px = R * Math.sin(a),
        py = R * Math.cos(a)
      pins.push({ x: px, y: py, z })
      shaft(crank, 0.2, 0.62, materials.silver, px, py, z)
      for (const side of [-1, 1]) {
        const web = new THREE.Group()
        web.position.set(0, 0, z + side * 0.41)
        web.rotation.z = -a
        crank.add(web)
        box(web, 0.45, 0.66, 0.18, materials.steel, 0, 0.27, 0)
        shaft(web, 0.28, 0.18, materials.steel, 0, R, 0)
        const shape = new THREE.Shape()
        shape.moveTo(-0.31, 0.12)
        shape.lineTo(0.31, 0.12)
        shape.absarc(0, -0.12, 0.7, 0.2, -Math.PI - 0.2, true)
        shape.closePath()
        const counterGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.2,
          bevelEnabled: true,
          bevelSegments: 1,
          steps: 1,
          bevelSize: 0.035,
          bevelThickness: 0.03,
          curveSegments: 14,
        })
        mesh(web, counterGeo, materials.steel, 0, 0, -0.1)
        mergeStatic(web)
      }
    }
    for (let i = 0; i < 5; i++) shaft(crank, 0.24, 0.37, materials.silver, 0, 0, (i - 2) * spacing)
    mergeStatic(crank)
    const flywheel = new THREE.Group()
    flywheel.position.z = -3.64
    crank.add(flywheel)
    shaft(flywheel, 0.93, 0.19, materials.steel)
    shaft(flywheel, 0.7, 0.23, materials.dark)
    shaft(flywheel, 0.3, 0.27, materials.silver)
    for (let j = 0; j < 64; j++) {
      const a = (j / 64) * TAU
      const tooth = box(
        flywheel,
        0.065,
        0.095,
        0.21,
        materials.silver,
        0.97 * Math.cos(a),
        0.97 * Math.sin(a),
        0
      )
      tooth.rotation.z = a - Math.PI / 2
    }
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU
      shaft(flywheel, 0.047, 0.29, materials.brass, 0.46 * Math.cos(a), 0.46 * Math.sin(a), 0)
    }
    mergeStatic(flywheel)
    function deckGeometry() {
      const s = new THREE.Shape()
      s.moveTo(-0.76, -3)
      s.lineTo(0.76, -3)
      s.lineTo(0.76, 3)
      s.lineTo(-0.76, 3)
      s.closePath()
      for (let i = 0; i < 4; i++) {
        const hole = new THREE.Path()
        hole.absarc(0, (i - 1.5) * spacing, 0.572, 0, TAU, true)
        s.holes.push(hole)
      }
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.018,
        bevelSegments: 1,
        curveSegments: 32,
      })
      g.rotateX(Math.PI / 2)
      return g
    }
    type Bank = {
      group: THREE.Group
      block: THREE.Group
      camHolder: THREE.Group
      beta: number
      sign: number
    }
    type Cam = { shaft: THREE.Group; gear: THREE.Group; holder: THREE.Group }
    type Valve = { group: THREE.Group; spring: THREE.Mesh; exhaust: boolean }
    type GlowMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
    type Cylinder = {
      id: number
      bank: number
      beta: number
      sign: number
      z: number
      group: THREE.Group
      piston: THREE.Group
      rod: THREE.Group
      sleeve: THREE.Group
      head: THREE.Group
      valves: Valve[]
      gas: GlowMesh
      flash: GlowMesh
      badge: THREE.Sprite
      fireAngle: number
    }
    type Belt = { path: THREE.CatmullRomCurve3; teeth: THREE.InstancedMesh }
    const deckGeo = deckGeometry(),
      banks: Bank[] = [],
      cylinders: Cylinder[] = [],
      cams: Cam[] = [],
      belts: Belt[] = [],
      timing = new THREE.Group()
    engine.add(timing)
    const springPoints: THREE.Vector3[] = []
    for (let i = 0; i <= 112; i++) {
      const t = i / 112,
        a = t * TAU * 7
      springPoints.push(new THREE.Vector3(Math.cos(a) * 0.108, t, Math.sin(a) * 0.108))
    }
    const springGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(springPoints),
      112,
      0.018,
      5,
      false
    )
    const camShape = new THREE.Shape()
    for (let j = 0; j <= 48; j++) {
      const a = (j / 48) * TAU
      const r = 0.17 + 0.2 * Math.pow(Math.max(0, Math.cos(a)), 3)
      const x = Math.sin(a) * r,
        y = Math.cos(a) * r
      if (j === 0) camShape.moveTo(x, y)
      else camShape.lineTo(x, y)
    }
    const camGeo = new THREE.ExtrudeGeometry(camShape, {
      depth: 0.135,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.015,
      curveSegments: 32,
    })
    camGeo.translate(0, 0, -0.0675)
    function numberSprite(num: number) {
      const c = document.createElement('canvas')
      c.width = c.height = 96
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#1e2429'
      ctx.beginPath()
      ctx.arc(48, 48, 35, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#aa9b88'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#e9dfd1'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '34px monospace'
      ctx.fillText(String(num), 48, 49)
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(c),
          depthTest: true,
          transparent: true,
        })
      )
      sprite.scale.set(0.29, 0.29, 0.29)
      return sprite
    }
    function gear(parent: THREE.Object3D, r: number, z: number, material: Material, teeth: number) {
      const g = new THREE.Group()
      g.position.z = z
      parent.add(g)
      shaft(g, r, 0.11, material)
      shaft(g, r * 0.78, 0.135, materials.dark)
      shaft(g, r * 0.31, 0.18, materials.brass)
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU
        const m = box(
          g,
          0.067,
          0.078,
          0.12,
          material,
          (r + 0.026) * Math.cos(a),
          (r + 0.026) * Math.sin(a),
          0
        )
        m.rotation.z = a - Math.PI / 2
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU
        const m = box(
          g,
          0.08,
          r * 0.8,
          0.15,
          material,
          r * 0.44 * Math.sin(a),
          r * 0.44 * Math.cos(a),
          0
        )
        m.rotation.z = -a
      }
      mergeStatic(g)
      return g
    }
    for (let bankIndex = 0; bankIndex < 2; bankIndex++) {
      const beta = (bankIndex === 0 ? 45 : -45) * DEG,
        sign = bankIndex === 0 ? 1 : -1
      const bank = new THREE.Group()
      bank.rotation.z = -beta
      engine.add(bank)
      const block = new THREE.Group()
      bank.add(block)
      mesh(block, deckGeo, blockEdge, 0, 2.8, 0)
      mesh(block, deckGeo, blockMat, 0, 1.01, 0)
      for (const side of [-1, 1]) {
        box(block, 0.12, 1.76, 6, blockMat, side * 0.72, 1.85, 0)
        for (let f = 0; f < 7; f++)
          box(block, 0.075, 0.045, 5.92, blockMat, side * 0.8, 1.15 + f * 0.23, 0)
        for (let i = 0; i < 5; i++) {
          box(block, 0.19, 1.9, 0.1, blockMat, side * 0.76, 1.83, (i - 2) * spacing)
          bolt(block, side * 0.65, 2.86, (i - 2) * spacing).material = blockEdge
        }
        box(block, 0.15, 0.13, 6.1, blockEdge, side * 0.7, 2.83, 0)
      }
      for (const end of [-1, 1]) box(block, 1.52, 1.7, 0.14, blockMat, 0, 1.84, end * 2.97)
      mergeStatic(block)
      const camHolder = new THREE.Group()
      bank.add(camHolder)
      const cam = new THREE.Group()
      cam.position.y = 3.76
      camHolder.add(cam)
      shaft(cam, 0.116, 6.35, materials.steel)
      for (let j = 0; j < 5; j++) {
        shaft(cam, 0.155, 0.14, materials.brass, 0, 0, (j - 2) * spacing)
        box(camHolder, 0.41, 0.2, 0.17, materials.edge, 0, 3.72, (j - 2) * spacing)
        box(camHolder, 0.12, 0.39, 0.14, materials.dark, -0.18, 3.5, (j - 2) * spacing)
        box(camHolder, 0.12, 0.39, 0.14, materials.dark, 0.18, 3.5, (j - 2) * spacing)
      }
      const camGear = gear(camHolder, 0.47, 3.34, materials.steel, 40)
      camGear.position.y = 3.76
      banks.push({ group: bank, block, camHolder, beta, sign })
      cams.push({ shaft: cam, gear: camGear, holder: camHolder })
      for (let i = 0; i < 4; i++) {
        const id = i * 2 + (bankIndex === 0 ? 1 : 2),
          z = (1.5 - i) * spacing + sign * 0.14
        const cylinder = new THREE.Group()
        cylinder.position.z = z
        bank.add(cylinder)
        const sleeve = new THREE.Group()
        cylinder.add(sleeve)
        mesh(
          sleeve,
          geo('glass', () => new THREE.CylinderGeometry(0.566, 0.566, 1.84, 48, 1, true)),
          glass,
          0,
          1.94,
          0
        )
        for (const y of [1.02, 2.83]) {
          torus(sleeve, 0.558, 0.035, materials.silver, 0, y, 0)
          torus(sleeve, 0.573, 0.021, materials.brass, 0, y + 0.06, 0)
        }
        const piston = new THREE.Group()
        cylinder.add(piston)
        cyl(piston, 0.526, 0.48, materials.silver)
        cyl(piston, 0.5, 0.065, materials.edge, 0, -0.268, 0)
        cyl(piston, 0.517, 0.035, materials.silver, 0, 0.258, 0)
        for (const y of [0.16, 0.215, -0.17]) torus(piston, 0.528, 0.012, materials.dark, 0, y, 0)
        for (const x of [-0.24, 0.24]) {
          cyl(piston, 0.132, 0.008, materials.steel, x, 0.28, 0)
          torus(piston, 0.132, 0.008, materials.silver, x, 0.286, 0)
        }
        shaft(piston, 0.09, 1.13, materials.brass, 0, -0.05, 0)
        mergeStatic(piston)
        const rod = new THREE.Group()
        cylinder.add(rod)
        box(rod, 0.21, L, 0.14, materials.silver, 0, L / 2, 0)
        box(rod, 0.065, L - 0.26, 0.17, materials.steel, 0, L / 2, 0)
        shaft(rod, 0.254, 0.23, materials.brass)
        shaft(rod, 0.182, 0.25, materials.steel)
        shaft(rod, 0.148, 0.17, materials.brass, 0, L, 0)
        for (const s of [-1, 1]) box(rod, 0.066, 0.22, 0.21, materials.silver, s * 0.19, 0, 0)
        mergeStatic(rod)
        const head = new THREE.Group()
        cylinder.add(head)
        torus(head, 0.565, 0.066, materials.edge, 0, 2.99, 0)
        // Two valves along the shaft; a single overhead cam operates both followers.
        const valves: Valve[] = []
        for (let v = 0; v < 2; v++) {
          const vz = v === 0 ? 0.255 : -0.255
          const valve = new THREE.Group()
          valve.position.set(0, 2.91, vz)
          head.add(valve)
          cyl(valve, 0.19, 0.055, v === 0 ? materials.silver : materials.copper)
          cyl(valve, 0.042, 0.69, materials.silver, 0, 0.355, 0)
          cyl(valve, 0.13, 0.047, materials.brass, 0, 0.62, 0)
          cyl(valve, 0.15, 0.075, materials.steel, 0, 0.69, 0)
          mergeStatic(valve)
          const spring = mesh(head, springGeo, materials.steel, 0, 3.1, vz)
          spring.scale.y = 0.38
          spring.userData.keep = true
          cyl(head, 0.143, 0.035, materials.brass, 0, 3.1, vz)
          cyl(head, 0.076, 0.15, materials.brass, 0, 3.015, vz)
          const fireAngle = order.indexOf(id) * 90
          const peakCycle = v === 0 ? 94 : 630
          // Cam nose points at the follower at the exact maximum valve lift.
          const peakTheta = fireAngle - 360 + peakCycle
          const lobe = mesh(cam, camGeo, materials.steel, 0, 0, z + vz)
          lobe.rotation.z = Math.PI + (peakTheta * DEG) / 2
          valves.push({ group: valve, spring, exhaust: v === 1 })
        }
        const plug = new THREE.Group()
        plug.position.set(0.31, 3.0, 0)
        plug.rotation.z = -0.15
        head.add(plug)
        cyl(plug, 0.068, 0.28, materials.silver)
        cyl(plug, 0.104, 0.1, materials.brass, 0, 0.14, 0, 6)
        cyl(plug, 0.06, 0.27, materials.ceramic, 0, 0.31, 0)
        for (let t = 0; t < 4; t++)
          torus(plug, 0.06, 0.009, materials.ceramic, 0, 0.22 + t * 0.046, 0)
        cyl(plug, 0.036, 0.11, materials.dark, 0, 0.5, 0)
        box(plug, 0.018, 0.1, 0.022, materials.silver, 0, -0.18, 0)
        mergeStatic(plug)
        const badge = numberSprite(id)
        badge.position.set(sign * 0.67, 3.03, 0)
        head.add(badge)
        const gasMaterial = new THREE.MeshBasicMaterial({
          color: phaseColors[2],
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        const gas = mesh(
          cylinder,
          geo('gas', () => new THREE.CylinderGeometry(0.502, 0.502, 1, 32, 1)),
          gasMaterial,
          0,
          2.7,
          0
        )
        gas.castShadow = false
        gas.renderOrder = 1
        const flash = mesh(
          cylinder,
          geo('flash', () => new THREE.SphereGeometry(0.15, 12, 8)),
          new THREE.MeshBasicMaterial({
            color: 0xffdeb1,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
          0.24,
          2.87,
          0
        )
        flash.scale.set(1, 0.4, 1)
        flash.castShadow = false
        flash.renderOrder = 2
        mergeStatic(head)
        mergeStatic(sleeve)
        cylinders.push({
          id,
          bank: bankIndex,
          beta,
          sign,
          z,
          group: cylinder,
          piston,
          rod,
          sleeve,
          head,
          valves,
          gas,
          flash,
          badge,
          fireAngle: order.indexOf(id) * 90,
        })
      }
      mergeStatic(cam)
      mergeStatic(camHolder)
    }
    // Synchronous 2:1 timing drive: two belts, 20-tooth crank and 40-tooth cam pulleys.
    const crankGear = gear(timing, 0.235, 3.36, materials.brass, 20)
    for (let bi = 0; bi < 2; bi++) {
      const b = banks[bi],
        top = new THREE.Vector2(Math.sin(b.beta) * 3.76, Math.cos(b.beta) * 3.76),
        bottom = new THREE.Vector2(0, 0),
        r1 = 0.27,
        r2 = 0.505,
        dist = top.length(),
        axis = Math.atan2(top.y, top.x),
        delta = Math.acos((r1 - r2) / dist)
      const pts: THREE.Vector3[] = []

      // External common tangents joined by pulley arcs, sampled as a closed path.
      const a1 = axis + delta,
        a2 = axis - delta
      for (let j = 0; j <= 30; j++) {
        const a = a1 + ((a2 + TAU - a1) * j) / 30
        pts.push(
          new THREE.Vector3(
            bottom.x + r1 * Math.cos(a),
            bottom.y + r1 * Math.sin(a),
            3.37 + bi * 0.025
          )
        )
      }
      pts.push(
        new THREE.Vector3(top.x + r2 * Math.cos(a2), top.y + r2 * Math.sin(a2), 3.37 + bi * 0.025)
      )
      for (let j = 1; j <= 45; j++) {
        const a = a2 + ((a1 - a2) * j) / 45
        pts.push(
          new THREE.Vector3(top.x + r2 * Math.cos(a), top.y + r2 * Math.sin(a), 3.37 + bi * 0.025)
        )
      }
      const path = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.1)
      mesh(timing, new THREE.TubeGeometry(path, 150, 0.031, 5, true), materials.rubber)
      const toothGeometry = new THREE.BoxGeometry(0.071, 0.043, 0.09)
      const teeth = new THREE.InstancedMesh(toothGeometry, materials.steel, 72)
      teeth.castShadow = false
      teeth.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      timing.add(teeth)
      belts.push({ path, teeth })
    }
    // Motor mounts and the engraved front plate.
    const trim = new THREE.Group()
    engine.add(trim)
    for (const s of [-1, 1]) {
      box(trim, 0.55, 0.19, 0.54, materials.dark, s * 1.13, -0.78, 1.85)
      box(trim, 0.55, 0.19, 0.54, materials.dark, s * 1.13, -0.78, -1.85)
      for (const z of [-1.85, 1.85]) bolt(trim, s * 1.19, -0.65, z, 1.25)
    }
    mergeStatic(trim)
    const labels: Array<{
      el: HTMLDivElement
      line: SVGPolylineElement
      dot: SVGCircleElement
      object: THREE.Object3D
      local: THREE.Vector3
      offset: Vec2
      smallOffset: Vec2
    }> = []
    cleanups.push(() => {
      for (const l of labels) {
        l.el.remove()
        l.line.remove()
        l.dot.remove()
      }
    })
    function addLabel(
      title: string,
      sub: string,
      object: THREE.Object3D,
      local: Vec3,
      offset: Vec2,
      smallOffset: Vec2
    ) {
      const el = document.createElement('div')
      el.className = 'part-label'
      el.innerHTML = `${title}<small>${sub}</small>`
      $('labels').appendChild(el)
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', '#9babb16b')
      line.setAttribute('stroke-width', '1')
      $('leader-lines').appendChild(line)
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('r', '2')
      dot.setAttribute('fill', '#d49d7d')
      $('leader-lines').appendChild(dot)
      labels.push({
        el,
        line,
        dot,
        object,
        local: new THREE.Vector3(...local),
        offset,
        smallOffset,
      })
    }
    const c1 = cylinders.find((c) => c.id === 1)!
    addLabel('Camshaft', '½ CRANKSHAFT SPEED', cams[0].holder, [0, 3.76, 1.7], [90, -65], [24, -46])
    addLabel('Piston and rod', 'ALUMINUM / STEEL', c1.piston, [0.45, 0, 0], [90, 15], [30, 30])
    addLabel('Crankshaft', 'CROSS-PLANE · 90°', crank, [0, 0, 1.4], [-190, 68], [-125, 42])
    addLabel(
      'Cylinder block',
      'V-TYPE · 90°',
      banks[1].block,
      [-0.75, 1.8, -1.5],
      [-155, -50],
      [-118, -45]
    )
    addLabel('Flywheel', 'ROTATIONAL INERTIA', flywheel, [0.6, 0, 0], [-145, 45], [-120, 10])
    const tempV = new THREE.Vector3(),
      tempV2 = new THREE.Vector3(),
      dummy = new THREE.Object3D()
    let cameraTween: {
      from: THREE.Vector3
      to: THREE.Vector3
      targetFrom: THREE.Vector3
      targetTo: THREE.Vector3
      t: number
    } | null = null
    function stopAuto() {
      if (state.auto) {
        state.auto = false
        $('auto').classList.remove('active')
        $('auto').setAttribute('aria-pressed', 'false')
      }
    }
    function cameraPreset(name: CameraName, instant = false) {
      state.camera = name
      root.querySelectorAll<HTMLElement>('[data-camera]').forEach((b) => {
        const active = b.dataset.camera === name
        b.classList.toggle('active', active)
        b.setAttribute('aria-pressed', String(active))
      })
      const target = new THREE.Vector3(0, 1.3, 0)
      let p: THREE.Vector3
      const spread = state.mode === 'exploded' ? 1.28 : 1
      const presets: Record<string, Vec3> = {
        general: [10.5, 7.1, 11.5],
        front: [0.01, 3.1, 17],
        side: [17, 4.4, 0.01],
        top: [0.01, 18, 0.001],
      }
      if (name === 'cylinder' || state.mode === 'single') {
        const c = cylinders.find((c) => c.id === state.selected)!
        target.set(Math.sin(c.beta) * 2.12, Math.cos(c.beta) * 2.12, c.z)
        const closeViews: Record<string, Vec3> = {
          front: [0.01, 0.8, 7],
          side: [c.sign * 7, 1, 0.01],
          top: [0.001, 7, 0.001],
        }
        p = target.clone().add(new THREE.Vector3(...(closeViews[name] || [c.sign * 4.1, 2.4, 5.2])))
      } else {
        p = new THREE.Vector3(...(presets[name] || presets.general))
        p.sub(target).multiplyScalar(spread).add(target)
      }
      if (mobileQuery.matches) {
        const fit =
          name === 'cylinder' || state.mode === 'single'
            ? Math.max(1.5, (1.65 * 844) / innerHeight)
            : Math.max((1.55 * 844) / innerHeight, (((2 * innerHeight) / 844) * 390) / innerWidth)
        p.sub(target).multiplyScalar(fit).add(target)
      } else
        p.sub(target)
          .multiplyScalar(Math.max(1, 900 / innerHeight, 1200 / innerWidth))
          .add(target)
      if (instant) {
        camera.position.copy(p)
        controls.target.copy(target)
        controls.update()
        cameraTween = null
      } else {
        cameraTween = {
          from: camera.position.clone(),
          to: p,
          targetFrom: controls.target.clone(),
          targetTo: target,
          t: 0,
        }
      }
    }
    const modeCopy: Record<Mode, [string, string, string]> = {
      assembled: [
        '01 / STRUCTURE',
        'Built to work as one.',
        'The block, the timing drive and eight cylinders\nin working position.',
      ],
      cutaway: [
        '02 / INSIDE',
        'Everything hidden under the metal.',
        'A lengthwise cut through the block reveals\nthe engine kinematics.',
      ],
      exploded: [
        '03 / PARTS',
        'Every part matters.',
        'Study how the engine is built\nin an exploded view.',
      ],
      single: [
        '04 / WORKING CYCLE',
        'Four strokes. Continuous power.',
        'The color shows the current stroke\nof the selected cylinder.',
      ],
    }
    function setMode(mode: Mode, automated = false) {
      if (!automated) stopAuto()
      state.mode = mode
      root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
        const active = b.dataset.mode === mode
        b.classList.toggle('active', active)
        b.setAttribute('aria-pressed', String(active))
      })
      const clipped = mode === 'cutaway'
      for (const m of [blockMat, blockEdge]) {
        m.clippingPlanes = clipped ? [clip] : []
        m.needsUpdate = true
      }
      const single = mode === 'single'
      housing.visible = !single
      trim.visible = !single
      timing.visible = !single
      crank.visible = !single
      banks.forEach((b) => {
        b.block.visible = !single
      })
      cylinders.forEach((c) => (c.group.visible = !single || c.id === state.selected))
      cams.forEach((c) => {
        c.holder.visible = !single
      })
      const text = modeCopy[mode]
      $('mode-index').textContent = text[0]
      $('mode-title').textContent = text[1]
      $('mode-description').textContent = text[2]
      cameraPreset(single ? 'cylinder' : 'general')
    }
    function setSelected(id: number, notify = true) {
      state.selected = id
      $('cylinder-badge').textContent = `CYL. ${String(id).padStart(2, '0')}`
      root.querySelectorAll<HTMLElement>('[data-cylinder]').forEach((b) => {
        b.classList.toggle('selected', Number(b.dataset.cylinder) === id)
        b.setAttribute('aria-pressed', String(Number(b.dataset.cylinder) === id))
      })
      if (state.mode === 'single') {
        cylinders.forEach((c) => (c.group.visible = c.id === id))
        cameraPreset('cylinder')
      } else if (state.camera === 'cylinder') cameraPreset('cylinder')
      if (notify) toast(`Telemetry: cylinder ${id}`)
    }
    const firingOrder = $('firing-order')
    for (const id of order) {
      const b = document.createElement('button')
      b.textContent = String(id)
      b.dataset.cylinder = String(id)
      b.title = `Watch cylinder ${id}`
      b.setAttribute('aria-label', `Select cylinder ${id}`)
      listen(b, 'click', () => {
        stopAuto()
        setSelected(id)
      })
      firingOrder.appendChild(b)
    }
    cleanups.push(() => firingOrder.replaceChildren())
    function setPlaying(on: boolean) {
      state.playing = on
      $('play').setAttribute('aria-label', on ? 'Pause the engine' : 'Start the engine')
      $('play').innerHTML = on
        ? '<svg viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" stroke-width="2.5"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="m5 3 8 5-8 5Z" fill="currentColor" stroke="none"/></svg>'
    }
    const rpmInput = $<HTMLInputElement>('rpm')
    function setRPM(value: number | string) {
      state.rpm = Number(value)
      rpmInput.value = String(state.rpm)
      $('rpm-value').textContent = state.rpm.toLocaleString('en-US')
      rpmInput.setAttribute('aria-valuetext', `${state.rpm} revolutions per minute`)
      const pct = ((state.rpm - 700) / 5300) * 100
      rpmInput.style.background = `linear-gradient(to right,var(--red) ${pct}%,#3a3e44 ${pct}%)`
    }
    function setTimeScale(value: number) {
      state.timeScale = value
      $('time-value').textContent = '×' + String(value)
      $('time-caption').textContent =
        value === 1 ? 'Real time' : `Slowed down ${Math.round(1 / value)}×`
    }
    listen(rpmInput, 'input', () => setRPM(rpmInput.value))
    listen($('play'), 'click', () => setPlaying(!state.playing))
    listen($('step'), 'click', () => {
      stopAuto()
      setPlaying(false)
      state.angle = mod((Math.floor(state.angle / 90) + 1) * 90, 720)
    })
    listen($('time-scale'), 'click', () => {
      const speeds = [0.01, 0.05, 0.2, 1]
      setTimeScale(speeds[(speeds.indexOf(state.timeScale) + 1) % speeds.length])
      toast(
        state.timeScale === 1 ? 'Real rotation speed' : 'Time scale ' + $('time-value').textContent
      )
    })
    root
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => listen(b, 'click', () => setMode(b.dataset.mode as Mode)))
    root.querySelectorAll<HTMLElement>('[data-camera]').forEach((b) =>
      listen(b, 'click', () => {
        stopAuto()
        cameraPreset(b.dataset.camera as CameraName)
      })
    )
    root.querySelectorAll<HTMLElement>('[data-phase]').forEach((b) =>
      listen(b, 'click', () => {
        stopAuto()
        setPlaying(false)
        state.angle = mod(
          order.indexOf(state.selected) * 90 - 360 + Number(b.dataset.phase) * 180 + 75,
          720
        )
        toast('Paused: ' + phaseNames[Number(b.dataset.phase)])
      })
    )
    listen($('auto'), 'click', () => {
      state.auto = !state.auto
      state.autoElapsed = 0
      $('auto').classList.toggle('active', state.auto)
      $('auto').setAttribute('aria-pressed', String(state.auto))
      if (state.auto) {
        setPlaying(true)
        toast('Auto tour: a new view every 9 seconds')
      }
    })
    listen($('fullscreen'), 'click', async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
        else await document.exitFullscreen()
      } catch {
        toast('Full screen is not available in this window')
      }
    })
    controls.addEventListener('start', () => {
      cameraTween = null
      stopAuto()
      root.querySelectorAll<HTMLElement>('[data-camera]').forEach((b) => {
        b.classList.remove('active')
        b.setAttribute('aria-pressed', 'false')
      })
    })
    listen(window, 'keydown', (e: KeyboardEvent) => {
      if (
        helpDialog.open ||
        ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SUMMARY'].includes(
          document.activeElement?.tagName ?? ''
        ) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!state.playing)
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        $('step').click()
      }
      if (e.code === 'KeyR') {
        stopAuto()
        setRPM(1200)
        setTimeScale(0.05)
        setSelected(1, false)
        setMode('cutaway')
        setPlaying(true)
        toast('Default view restored')
      }
    })
    listen(renderer.domElement, 'webglcontextlost', (e: Event) => {
      e.preventDefault()
      fail('The WebGL context was lost. Reload the model.')
    })
    type Chart = { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number }
    const chartContexts: Chart[] = [
      $<HTMLCanvasElement>('pressure-chart'),
      $<HTMLCanvasElement>('valve-chart'),
    ].map((el) => ({ el, ctx: el.getContext('2d')!, w: 0, h: 0 }))
    function drawChart(item: Chart, cycle: number, type: number) {
      const rect = item.el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const dpr = Math.min(devicePixelRatio, 2),
        w = rect.width,
        h = rect.height
      if (item.w !== w || item.h !== h) {
        item.el.width = Math.round(w * dpr)
        item.el.height = Math.round(h * dpr)
        item.w = w
        item.h = h
      }
      const ctx = item.ctx
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = '#ffffff08'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * w
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.moveTo(0, (i * h) / 3)
        ctx.lineTo(w, (i * h) / 3)
        ctx.stroke()
      }
      const curve = (fn: (angle: number) => number, color: string, fill = false) => {
        ctx.beginPath()
        for (let i = 0; i <= 180; i++) {
          const x = (i / 180) * w,
            y = h - 4 - fn(i * 4) * (h - 9)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        if (fill) {
          ctx.lineTo(w, h)
          ctx.lineTo(0, h)
          ctx.closePath()
          const grad = ctx.createLinearGradient(0, 0, 0, h)
          grad.addColorStop(0, color + '55')
          grad.addColorStop(1, color + '00')
          ctx.fillStyle = grad
          ctx.fill()
        } else {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
      if (type === 0) {
        curve((a) => pressure(a) / 49, '#fa8767', true)
        curve((a) => pressure(a) / 49, '#fa8767')
      } else {
        curve((a) => valveLift(a) / 0.235, '#75b6df')
        curve((a) => valveLift(a, true) / 0.235, '#fa8767')
      }
      const x = (cycle / 720) * w
      ctx.strokeStyle = '#d2d5da88'
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
      ctx.setLineDash([])
      const y =
        h -
        4 -
        (type === 0
          ? pressure(cycle) / 49
          : Math.max(valveLift(cycle), valveLift(cycle, true)) / 0.235) *
          (h - 9)
      ctx.fillStyle = type === 0 ? '#ffd0b7' : '#dde5eb'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, TAU)
      ctx.fill()
    }
    let previousPhase = -1,
      lastFiring = -1
    function updateTelemetry() {
      const cycle = cycleFor(state.selected),
        phase = Math.floor(cycle / 180)
      if (phase !== previousPhase) {
        previousPhase = phase
        $('phase-name').textContent = phaseNames[phase]
        $('phase-dot').style.background = phaseColors[phase]
        $('phase-dot').style.boxShadow = `0 0 12px ${phaseColors[phase]}44`
        $('phase-description').textContent = phaseDescriptions[phase]
        root
          .querySelectorAll<HTMLElement>('[data-phase]')
          .forEach((b) => b.classList.toggle('active', Number(b.dataset.phase) === phase))
      }
      $('pressure-value').textContent = pressure(cycle).toFixed(1) + ' bar'
      $('angle-value').textContent = Math.floor(cycle) + '°'
      $('mobile-phase').textContent =
        `Cyl. ${String(state.selected).padStart(2, '0')} · ${phaseNames[phase]}`
      drawChart(chartContexts[0], cycle, 0)
      drawChart(chartContexts[1], cycle, 1)
      const firing = Math.floor(mod(state.angle, 720) / 90)
      if (firing !== lastFiring) {
        lastFiring = firing
        root
          .querySelectorAll<HTMLElement>('[data-cylinder]')
          .forEach((b) =>
            b.classList.toggle('active', Number(b.dataset.cylinder) === order[firing])
          )
      }
    }
    function updateMechanics() {
      const theta = state.angle * DEG,
        e = state.explode
      crank.rotation.z = -theta
      crank.position.y = -e * 0.65
      flywheel.position.z = -3.64 - e * 1.2
      timing.position.z = e * 0.9
      housing.position.y = -e * 0.9
      trim.position.y = -e * 0.9
      banks.forEach((b) => {
        b.group.position.x = b.sign * e * 0.85
        b.group.position.y = e * 0.28
        b.block.position.x = b.sign * e * 0.78
      })
      cams.forEach((c) => {
        c.shaft.rotation.z = -theta / 2
        c.gear.rotation.z = -theta / 2
        c.holder.position.y = e * 0.85
      })
      crankGear.rotation.z = -theta
      for (const c of cylinders) {
        const a = theta + pinOffsets[(c.id - 1) >> 1] * DEG,
          px = R * Math.sin(a),
          py = R * Math.cos(a),
          sin = Math.sin(c.beta),
          cos = Math.cos(c.beta)
        // Transform the shared crank pin into the bank's local coordinates.
        const pinX = px * cos - py * sin,
          pinY = px * sin + py * cos
        const height = pinY + Math.sqrt(L * L - pinX * pinX)
        c.piston.position.y = height + e * 0.2
        c.rod.position.set(pinX, pinY + e * 0.2, 0)
        c.rod.rotation.z = Math.atan2(pinX, height - pinY)
        c.sleeve.position.y = e * 0.52
        c.head.position.y = e * 0.65
        const cycle = cycleFor(c.id),
          phase = Math.floor(cycle / 180)
        c.valves.forEach((v) => {
          const lift = valveLift(cycle, v.exhaust)
          v.group.position.y = 2.91 - lift
          v.spring.scale.y = 0.38 - lift
        })
        const chamberHeight = Math.max(0.06, 2.91 - (height + 0.28))
        c.gas.position.y = height + 0.28 + chamberHeight / 2 + e * 0.2
        c.gas.scale.y = chamberHeight
        c.gas.material.color.set(phaseColors[phase])
        c.gas.material.opacity = (state.mode === 'single' ? 0.28 : 0.13) * (phase === 2 ? 1.3 : 1)
        c.gas.visible = state.mode !== 'assembled'
        const sinceFire = mod(state.angle - c.fireAngle, 720),
          flash = sinceFire < 23 ? Math.pow(1 - sinceFire / 23, 2) : 0
        c.flash.material.opacity = flash * 0.95
        c.flash.scale.setScalar(0.5 + flash * 1.8)
        c.flash.position.y = 2.85 + e * 0.65
        c.badge.material.opacity = c.id === state.selected ? 1 : 0.75
      }
      for (let b = 0; b < belts.length; b++) {
        const { path, teeth } = belts[b]
        for (let i = 0; i < teeth.count; i++) {
          const t = mod(i / teeth.count + (theta * 0.27) / path.getLength(), 1)
          path.getPointAt(t, tempV)
          path.getTangentAt(t, tempV2)
          dummy.position.copy(tempV)
          dummy.rotation.set(0, 0, Math.atan2(tempV2.y, tempV2.x))
          dummy.updateMatrix()
          teeth.setMatrixAt(i, dummy.matrix)
        }
        teeth.instanceMatrix.needsUpdate = true
      }
    }
    function updateLabels() {
      const visible = state.mode === 'exploded' && state.explode > 0.5
      const mobile = mobileQuery.matches
      for (let i = 0; i < labels.length; i++) {
        const l = labels[i]
        if (!visible || (mobile && i > 2)) {
          l.el.style.display = 'none'
          l.line.style.display = 'none'
          l.dot.style.display = 'none'
          continue
        }
        l.object.getWorldPosition(tempV)
        tempV.copy(l.local)
        l.object.localToWorld(tempV)
        tempV.project(camera)
        if (tempV.z > 1 || tempV.z < -1) {
          l.el.style.display = 'none'
          l.line.style.display = 'none'
          l.dot.style.display = 'none'
          continue
        }
        const x = (tempV.x * 0.5 + 0.5) * innerWidth,
          y = (-tempV.y * 0.5 + 0.5) * innerHeight
        const offset = mobile ? l.smallOffset : l.offset
        l.el.style.display = 'block'
        const w = l.el.offsetWidth,
          h = l.el.offsetHeight
        const lx = Math.max(12, Math.min(innerWidth - w - 12, x + offset[0])),
          ly = Math.max(
            mobile ? 238 : 155,
            Math.min(innerHeight - (mobile ? 307 : 250), y + offset[1])
          )
        l.el.style.transform = `translate(${lx}px,${ly}px)`
        l.line.style.display = ''
        l.dot.style.display = ''
        const endX = offset[0] > 0 ? lx : lx + w
        l.line.setAttribute(
          'points',
          `${x},${y} ${(x + endX) / 2},${ly + h / 2} ${endX},${ly + h / 2}`
        )
        l.dot.setAttribute('cx', String(x))
        l.dot.setAttribute('cy', String(y))
      }
    }
    function resize() {
      camera.aspect = innerWidth / innerHeight
      camera.setViewOffset(
        innerWidth,
        innerHeight,
        0,
        mobileQuery.matches ? 30 : innerHeight * 0.1,
        innerWidth,
        innerHeight
      )
      camera.updateProjectionMatrix()
      renderer.setSize(innerWidth, innerHeight)
      cameraPreset(state.camera, true)
    }
    listen(window, 'resize', resize)
    listen(telemetry, 'toggle', () => updateTelemetry())
    setRPM(1200)
    setSelected(1, false)
    setMode('cutaway')
    resize()
    updateMechanics()
    updateTelemetry()
    renderer.compile(scene, camera)
    renderer.render(scene, camera)
    $('loading').classList.add('hidden')
    // Test diagnostics contain measurements only and do not change the simulation.
    window.__V8 = {
      state,
      renderer,
      scene,
      camera,
      cylinders,
      banks,
      cams,
      pins,
      cycleFor,
      pistonTravel,
      valveLift,
      pressure,
      setMode,
      cameraPreset,
      setSelected,
      updateMechanics,
      ready: true,
    }
    cleanups.push(() => {
      delete window.__V8
    })
    let last = performance.now(),
      uiAccumulator = 0,
      fpsTime = 0,
      frameCount = 0,
      qualityTimer = 0,
      autoIndex = 0
    const autoModes: Mode[] = ['cutaway', 'exploded', 'single', 'assembled']
    let rafId = 0
    function frame(now: number) {
      rafId = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (document.hidden) return
      if (state.playing) state.angle = mod(state.angle + dt * state.rpm * 6 * state.timeScale, 720)
      const desired = state.mode === 'exploded' ? 1 : 0
      state.explode += (desired - state.explode) * (1 - Math.exp(-dt * 4.5))
      if (Math.abs(desired - state.explode) < 0.001) state.explode = desired
      if (cameraTween) {
        const t = cameraTween
        t.t = Math.min(1, t.t + dt / 0.95)
        const k = t.t * t.t * (3 - 2 * t.t)
        camera.position.lerpVectors(t.from, t.to, k)
        controls.target.lerpVectors(t.targetFrom, t.targetTo, k)
        if (t.t >= 1) cameraTween = null
      }
      if (state.auto) {
        state.autoElapsed += dt
        if (state.autoElapsed >= 9) {
          state.autoElapsed = 0
          autoIndex = (autoIndex + 1) % autoModes.length
          setMode(autoModes[autoIndex], true)
        }
        if (!cameraTween) {
          tempV
            .copy(camera.position)
            .sub(controls.target)
            .applyAxisAngle(Y, dt * 0.12)
          camera.position.copy(controls.target).add(tempV)
        }
      }
      updateMechanics()
      controls.update()
      renderer.render(scene, camera)
      uiAccumulator += dt
      if (uiAccumulator > 1 / 30) {
        updateTelemetry()
        updateLabels()
        uiAccumulator = 0
      }
      fpsTime += dt
      frameCount++
      qualityTimer += dt
      if (fpsTime >= 1) {
        const fps = Math.round(frameCount / fpsTime)
        $('fps').textContent = `${fps} FPS · WEBGL`
        if (qualityTimer > 4 && fps < 43 && renderer.getPixelRatio() > 1) {
          renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.25))
          qualityTimer = 0
        }
        fpsTime = 0
        frameCount = 0
      }
    }
    listen(document, 'visibilitychange', () => {
      last = performance.now()
    })
    rafId = requestAnimationFrame(frame)
    cleanups.push(() => {
      cancelAnimationFrame(rafId)
      controls.dispose()
      // Free every GPU resource the scene created, then the context itself.
      const textures = new Set<THREE.Texture>()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const list = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : []
        for (const material of list) {
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value)
          material.dispose()
        }
      })
      textures.forEach((t) => t.dispose())
      envTarget.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    })
  } catch (error) {
    console.error('V8: failed to start', error)
    fail('Could not start WebGL. Turn on hardware acceleration and update your browser.')
  }
  return () => {
    for (const dispose of cleanups.reverse()) dispose()
    cleanups.length = 0
  }
}
