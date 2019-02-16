'use strict'

const tapeWithoutPromise = require('tape')
const addPromiseSupport = require('tape-promise').default
const tape = addPromiseSupport(tapeWithoutPromise)

const zhv = require('.')

tape('zhv-de', t => {
	t.ok(zhv)
})
