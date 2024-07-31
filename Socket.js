 const SOCKET_STATUS = {
  WAITING: 'waiting',//等待连接，初始状态
  CONNECTING: 'connecting',//连接中
  RECONNECTING: 'reconnecting',//重新连接中
  CONNECTED: 'connected',//已经连接成功
  CLOSING: 'closing'//关闭连接中
}

class Socket {
  #socket
  #url
  #onMsgCallback
  #statusCallback
  #autoReconnect
  #timeTask

  constructor(url, onMsgCallback, statusCallback) {
    this.#url = url
    this.#onMsgCallback = onMsgCallback
    this.#statusCallback = statusCallback
    this.status = SOCKET_STATUS.WAITING
  }

  connect(autoReconnect = true) {
    if (!this.#url) throw new Error('url is not initialized')
    if (this.#socket) throw new Error('socket is already initialized')
    this.#autoReconnect = autoReconnect
    return new Promise((resolve, reject) => this.#connect(resolve, reject))
  }

  #notifyStatus() {
    if (this.#statusCallback) {
      this.#statusCallback(this.status)
    }
  }

  #connect(resolve, reject) {
    if (this.status === SOCKET_STATUS.CLOSING) return
    console.log('socket connect')
    clearTimeout(this.#timeTask)
    this.#socket = new WebSocket(this.#url)
    this.status = SOCKET_STATUS.WAITING
    this.#socket.onopen = () => {
      console.log('socket onopen')
      if (this.status === SOCKET_STATUS.CLOSING) {
        this.close()
        return
      }
      this.status = SOCKET_STATUS.CONNECTED
      this.#notifyStatus()
      if (resolve) {
        resolve(true)
      }
    }
    this.#socket.onerror = (event) => {
      console.log('socket onerror')
      this.#socket.close()
      this.#socket = undefined
      if (this.#autoReconnect === true &&
        this.status !== SOCKET_STATUS.RECONNECTING &&
        this.status !== SOCKET_STATUS.CONNECTED &&
        this.status !== SOCKET_STATUS.CLOSING) {
        this.status = SOCKET_STATUS.RECONNECTING
        this.#notifyStatus()
        this.#timeTask = setTimeout(() => {
          this.#connect(resolve, reject)
        }, 3000)
        return
      } else if (reject) {
        reject(event)
      }
      this.status = SOCKET_STATUS.WAITING
      this.#notifyStatus()
    }
    this.#socket.onclose = (event) => {
      console.log('socket onclose', event)
      this.#socket = undefined
      this.status = SOCKET_STATUS.WAITING
      if (event.code === 1000) {
        this.#notifyStatus()
        return
      }
      if (this.#autoReconnect === true &&
        this.status !== SOCKET_STATUS.RECONNECTING &&
        this.status !== SOCKET_STATUS.CONNECTED &&
        this.status !== SOCKET_STATUS.CLOSING) {
        this.status = SOCKET_STATUS.RECONNECTING
        this.#notifyStatus()
        this.#timeTask = setTimeout(() => {
          this.#connect()
        }, 3000)
      } else {
        this.status = SOCKET_STATUS.WAITING
        this.#notifyStatus()
      }
    }
    this.#socket.onmessage = (event) => {
      if (this.#onMsgCallback && typeof this.#onMsgCallback === 'function') {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data)
            this.#onMsgCallback(data)
            console.log('Socket message received', data)
          } catch (e) {
            this.#onMsgCallback(event.data)
            console.log('Socket message received', event.data)
          }
        } else {
          this.#onMsgCallback(event.data)
        }
      }
    }
  }

  /**
   * 发送数据
   * @param data {string | Object | Blob}
   * @param sendType {string} 发送类型，可选值：binary、text
   */
  async send(data, sendType = 'text') {
    if (this.#socket && this.status === SOCKET_STATUS.CONNECTED) {
      let finalData
      if (data instanceof Blob || data instanceof ArrayBuffer) {
        finalData = data
      } else if (sendType === 'text') {
        if (typeof data === 'string') {
          finalData = data
        } else {
          finalData = JSON.stringify(data)
        }
      } else {
        if (typeof data === 'string') {
          finalData = new Blob([data])
        } else {
          finalData = new Blob([JSON.stringify(data)])
        }
      }
      this.#socket.send(finalData)
    }
  }

  close() {
    if (this.status === SOCKET_STATUS.CLOSING || this.status === SOCKET_STATUS.WAITING) return
    console.log('socket close')
    if (this.#socket && this.status === SOCKET_STATUS.CONNECTED) {
      this.#socket.close()
    }
    if (this.#timeTask) {
      clearTimeout(this.#timeTask)
      this.#timeTask = undefined
    }
    this.status = SOCKET_STATUS.CLOSING
    this.#autoReconnect = false
  }
}
