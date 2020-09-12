'use strict'

// the data is fetched and processed in these steps:
// 1. obtain a session cookie and the zip file's url
// 2. download the data using the session cookie
// 3. unzip the data, select and parse the decompressed csv file

const got = require('got')
const cheerio = require('cheerio')
const parseCsv = require('csv-parse')
const { extname } = require('path')
const stripBomStream = require('strip-bom-stream')
const mapStream = require('through2-map').obj
const parseDecimalNumber = require('parse-decimal-number')
const cldr = require('cldr')
const fromPairs = require('lodash/fromPairs')
const unzipper = require('unzipper')

const extractUrlFromResponse = html => {
	const parsed = cheerio.load(html)
	const url = parsed('a').filter(function (i, el) {
		// this === el
		return (parsed(this).attr('href') || '').endsWith('_zHV_gesamt.zip')
	}).attr('href')
	if (!url) throw new Error('no matching url found on download page. internal error or invalid credentials')
	return url
}

const getCookieAndUrl = async (user, password) => {
	const url = new URL('https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite')
	url.searchParams.append('tx_vrrkit_view[dataset_name]', 'deutschlandweite-haltestellendaten')
	url.searchParams.append('tx_vrrkit_view[action]', 'details')
	url.searchParams.append('tx_vrrkit_view[controller]', 'View')

	const response = await got.post(url, {
		form: {
			user,
			pass: password,
			submit: 'Anmelden',
			logintype: 'login',
			pid: 174,
			'tx_felogin_pi1[noredirect]': 0,
			referer: url.toString(),
		},
	})

	const cookie = (response.headers['set-cookie'] || []).find(c => c.includes('fe_typo_user'))
	if (!cookie) throw new Error('cookie not found. internal error or invalid credentials')

	const fileUrl = extractUrlFromResponse(response.body)
	return { cookie, url: fileUrl }
}

const germanNumberSymbols = cldr.extractNumberSymbols('de_DE')
const parseNumber = number => parseDecimalNumber(number, germanNumberSymbols)
const lowerCaseFirstLetter = string => string.length > 0 ? [string.charAt(0).toLowerCase(), string.slice(1)].join('') : ''

const parseEntry = entry => {
	const result = fromPairs(Object.entries(entry).map(([oldKey, value]) => {
		const key = lowerCaseFirstLetter(oldKey)
		if (value === 'Unknown' || value === '') return [key, undefined]
		if (value === '-') return [key, null]
		if (['longitude', 'latitude'].includes(key)) return [key, parseNumber(value)]
		return [key, value]
	}))
	return result
}

const selectAndParseCsvFromZip = async (zipStream) => {
	const outputStream = parseCsv({
		delimiter: ';',
		quote: '"',
		columns: true,
		skipLinesWithError: true, // sigh… there are unescaped quotes in the csv data, skipped for now
	})

	zipStream.pipe(unzipper.Parse()).on('entry', entry => {
		if (entry.type === 'File' && extname(entry.path) === '.csv') {
			entry.pipe(stripBomStream()).pipe(outputStream)
		} else {
			entry.autodrain()
		}
	})

	return outputStream.pipe(mapStream(parseEntry))
}

const zhv = async (user, password) => {
	if (typeof user !== 'string' || user.length === 0) throw new Error('user must be a non-empty string')
	if (typeof password !== 'string' || password.length === 0) throw new Error('password must be a non-empty string')

	const { url, cookie } = await getCookieAndUrl(user, password)
	const zipStream = await got.stream.get(url, { headers: { Cookie: cookie } })
	const dataStream = await selectAndParseCsvFromZip(zipStream)

	return dataStream
}

module.exports = zhv
