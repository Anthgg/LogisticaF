export class MockPopup {
  private _content = ''
  private _isOpen = false
  public element: HTMLElement

  constructor(_options?: any) {
    this.element = document.createElement('div')
    this.element.className = 'maplibregl-popup'
  }

  setHTML(html: string) {
    this._content = html
    this.element.innerHTML = html
    return this
  }

  getHTML() {
    return this._content
  }

  setDOMContent(node: HTMLElement) {
    this.element.replaceChildren(node)
    return this
  }

  setText(text: string) {
    this.element.textContent = text
    return this
  }

  addTo(map: MockMap) {
    this._isOpen = true
    if (map && (map as any)._container) {
      ;(map as any)._container.appendChild(this.element)
    }
    return this
  }

  remove() {
    this._isOpen = false
    this.element.remove()
    return this
  }

  isOpen() {
    return this._isOpen
  }
}

export class MockMarker {
  private _lngLat: { lng: number; lat: number } = { lng: 0, lat: 0 }
  private _draggable = false
  private _listeners: Record<string, Function[]> = {}
  private _popup: MockPopup | null = null
  private _map: MockMap | null = null
  public element: HTMLElement

  constructor(options?: { draggable?: boolean; color?: string; element?: HTMLElement }) {
    this._draggable = options?.draggable ?? false
    if (options?.element) {
      this.element = options.element
      this.element.classList.add('maplibregl-marker')
    } else {
      this.element = document.createElement('div')
      this.element.className = 'maplibregl-marker'
    }
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

  addTo(map: MockMap) {
    this._map = map
    if (map && (map as any)._container) {
      ;(map as any)._container.appendChild(this.element)
    }
    return this
  }

  remove() {
    this._listeners = {}
    this.element.remove()
    this._popup?.remove()
    this._map = null
    return this
  }

  setPopup(popup: MockPopup) {
    this._popup = popup
    return this
  }

  getPopup() {
    return this._popup
  }

  togglePopup() {
    if (this._popup && this._map) {
      if (this._popup.isOpen()) {
        this._popup.remove()
      } else {
        this._popup.addTo(this._map)
      }
    }
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
  Popup: MockPopup,
  NavigationControl: MockNavigationControl,
  supported: () => true,
}
