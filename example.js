'use strict'

const zhv = require('.')
const ndjson = require('ndjson')

const { USER: user, PASSWORD: password } = process.env
if (typeof user !== 'string' || user.length === 0) throw new Error('env.USER not set')
if (typeof password !== 'string' || password.length === 0) throw new Error('env.PASSWORD not set')

const main = async () => {
	const stream = await zhv(user, password)
	stream.pipe(ndjson.stringify()).pipe(process.stdout)
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
