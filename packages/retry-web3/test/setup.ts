import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setRetryWeb3Debug } from '../src/lib/logger.js'
import { resetEip6963Store } from '../src/react/eip6963.js'

setRetryWeb3Debug(false)

afterEach(() => {
  cleanup()
  resetEip6963Store()
  Reflect.deleteProperty(window, 'ethereum')
})
