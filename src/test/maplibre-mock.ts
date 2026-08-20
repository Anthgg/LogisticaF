export class MockMarker {
  private _lngLat: { lng: number; lat: number } = { lng: 0, lat: 0 }
  private _draggable = false
  private _listeners: Record<string, Function[]> = {}
  public element: HTMLElement

  constructor(options?: { draggable?: boolean; color?: string; element?: HTMLElement }) {
    this._draggable = options?.draggable ?? false
    this.element = options?.element ?? document.createElement('div')
    this.element.className = 'maplibregl-marker'
  }

  setLngLat(lngLat: [number, number] | { lng: number; lat: number }) {
    if (Array.isArray(lngLat)) {
      this._lngLat = { lng: lngLat[0], lat: lngLat[1] }
    } else {
      this._lngLat = { ...lngLat }
    }
    return this
  }

  getLngLat() {
    return { ...this._lngLat }
  }

  addTo(_map: MockMap) {
    return this
  }

  remove() {
    this._listeners = {}
    return this
  }

  setDraggable(draggable: boolean) {
    this._draggable = draggable
    return this
  }

  isDraggable() {
    return this._draggable
  }

  on(event: string, handler: Function) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(handler)
    return this
  }

  off(event: string, handler: Function) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((h) => h !== handler)
    }
    return this
  }

  _emit(event: string, data?: any) {
    this._listeners[event]?.forEach((h) => h(data))
  }
}

export class MockMap {
  private _listeners: Record<string, Function[]> = {}
  private _center: [number, number]
  private _zoom: number
  private _container: HTMLElement

  constructor(options: {
    container: HTMLElement | string
    center?: [number, number]
    zoom?: number
    style?: any
  }) {
    this._container =
      typeof options.container === 'string'
        ? document.getElementById(options.container)!
        : options.container
    this._center = options.center ?? [-77.0428, -12.0464]
    this._zoom = options.zoom ?? 12

    // Attach attribution element for testing
    if (this._container && typeof this._container.appendChild === 'function') {
      const attr = document.createElement('div')
      attr.className = 'maplibregl-ctrl-attrib'
      attr.textContent = '© OpenStreetMap contributors'
      this._container.appendChild(attr)
    }
  }

  on(event: string, handler: Function) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(handler)
    if (event === 'load') {
      setTimeout(() => handler({ type: 'load', target: this }), 0)
    }
    return this
  }

  off(event: string, handler: Function) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((h) => h !== handler)
    }
    return this
  }

  setCenter(center: [number, number]) {
    this._center = center
    return this
  }

  getCenter() {
    return { lng: this._center[0], lat: this._center[1] }
  }

  setZoom(zoom: number) {
    this._zoom = zoom
    return this
  }

  getZoom() {
    return this._zoom
  }

  flyTo(options: { center?: [number, number]; zoom?: number }) {
    if (options.center) this._center = options.center
    if (options.zoom !== undefined) this._zoom = options.zoom
    return this
  }

  easeTo(options: { center?: [number, number]; zoom?: number }) {
    return this.flyTo(options)
  }

  addControl(_control: any, _position?: string) {
    return this
  }

  removeControl(_control: any) {
    return this
  }

  resize() {
    return this
  }

  remove() {
    this._listeners = {}
  }

  _emit(event: string, data?: any) {
    this._listeners[event]?.forEach((h) => h(data))
  }
}

export class MockNavigationControl {
  onAdd(_map: MockMap) {
    const el = document.createElement('div')
    el.className = 'maplibregl-ctrl-group'
    return el
  }
  onRemove() {}
}

export const mockMapLibre = {
  Map: MockMap,
  Marker: MockMarker,
  NavigationControl: MockNavigationControl,
  supported: () => true,
}
