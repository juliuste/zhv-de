'use strict'

const tapeWithoutPromise = require('tape')
const addPromiseSupport = require('tape-promise').default
const tape = addPromiseSupport(tapeWithoutPromise)
const streamToPromise = require('get-stream').array

const zhv = require('.')

const { USERNAME: username, PASSWORD: password } = process.env
if (typeof username !== 'string' || username.length === 0) throw new Error('env.USERNAME not set')
if (typeof password !== 'string' || password.length === 0) throw new Error('env.PASSWORD not set')

tape('zhv-de', async t => {
	const stream = await zhv(username, password)
	const data = await streamToPromise(stream)
	data.forEach(entry => {
		t.ok(typeof entry.seqNo === 'string' && entry.seqNo.length > 0, 'seqNo')
		t.ok(typeof entry.type === 'string' && entry.type.length === 1, 'type') // @todo only match specific types like 'A' or 'S'
		t.ok(typeof entry.dHID === 'string' && entry.dHID.length > 0, 'dHID')
		t.ok(typeof entry.longitude === 'number', 'longitude')
		t.ok(typeof entry.latitude === 'number', 'latitude')
	})
	t.end()
})
