'use strict'

// the data is fetched and processed in five steps:
// 1. obtain a session id (not strictly necessary) and __VIEWSTATE (necessary) from the login page
// 2. use username, password, session id and __VIEWSTATE to receive an .ASPXAUTH
// 3. download the data using the session id and .ASPXAUTH
// 4. unzip the data, select and parse the decompressed csv file

const got = require('got')
const cheerio = require('cheerio')
const { parse: parseCookies, serialize: serializeCookie } = require('cookie')
const { stringify } = require('query-string')
const unzip = require('unzip')
const parseCsv = require('csv-parse')
const { extname } = require('path')
const stripBomStream = require('strip-bom-stream')
const mapStream = require('through2-map').obj
const parseDecimalNumber = require('parse-decimal-number')
const cldr = require('cldr')
const fromPairs = require('lodash.frompairs')

// 1st step: get sessionId and viewState
const getSessionInformation = async () => {
	// @todo proper handling for upstream errors
	const { headers, body } = await got.get('https://zhv.wvigmbh.de/Account/Login.aspx')
	const [rawCookies] = headers['set-cookie']
	const sessionId = parseCookies(rawCookies)['ASP.NET_SessionId']

	const parsedHTML = cheerio.load(body)
	const viewState = parsedHTML('input#__VIEWSTATE').attr('value')

	return { sessionId, viewState }
}

// 2nd step: get aspx auth token
const getAspxAuth = async ({ username, password, sessionId, viewState }) => {
	const { headers } = await got.post('https://zhv.wvigmbh.de/Account/Login.aspx', {
		headers: {
			'Cookie': serializeCookie('ASP.NET_SessionId', sessionId),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: stringify({
			__VIEWSTATE: viewState,
			'ctl00$ctl00$ASPxSplitter1$Content$MainContent$tbUserName': username,
			'ctl00$ctl00$ASPxSplitter1$Content$MainContent$tbPassword$State': '{&quot;validationState&quot;:&quot;&quot;}',
			'ctl00$ctl00$ASPxSplitter1$Content$MainContent$tbPassword': password,
			'ctl00$ctl00$ASPxSplitter1$Content$MainContent$btnLogin': 'Log In'
		})
	}).catch(error => {
		if (error.statusCode === 302 && error.headers['set-cookie']) return error
		throw error
	})

	const [rawCookies] = headers['set-cookie']
	const aspxAuth = parseCookies(rawCookies)['.ASPXAUTH']
	return aspxAuth
}

// 3rd step: download zipped data (returns a stream)
const getZippedData = async ({ sessionId, aspxAuth }) => {
	return got.post('https://zhv.wvigmbh.de/gridview.aspx', {
		headers: {
			'Cookie': [
				serializeCookie('ASP.NET_SessionId', sessionId),
				serializeCookie('.ASPXAUTH', aspxAuth)
			].join('; '),
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept': '*/*'
		},
		body: stringify({
			__EVENTTARGET: 'ctl00$ctl00$ASPxSplitter1$Content$ContentSplitter$MainContent$Druckmenu',
			__EVENTARGUMENT: 'CLICK:2'
		}),
		stream: true
	})
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

// 4th step: select csv file from zip and parse it
const selectAndParseCsvFromZip = zipStream => {
	const outputStream = parseCsv({
		delimiter: ';',
		quote: '"',
		columns: true,
		skipLinesWithError: true // sigh… there are unescaped quotes in the csv data, skipped for now
	})

	zipStream.pipe(unzip.Parse()).on('entry', entry => {
		if (entry.type === 'File' && extname(entry.path) === '.csv') {
			entry.pipe(stripBomStream()).pipe(outputStream)
		} else {
			entry.autodrain()
		}
	})

	return outputStream.pipe(mapStream(parseEntry))
}

const zhv = async (username, password) => {
	if (typeof username !== 'string' || username.length === 0) throw new Error('username must be a non-empty string')
	if (typeof password !== 'string' || password.length === 0) throw new Error('password must be a non-empty string')

	const { sessionId, viewState } = await getSessionInformation()
	if (typeof sessionId !== 'string' || sessionId.length === 0) throw new Error('upstream error: invalid sessionId, please inform the package maintainer')
	if (typeof viewState !== 'string' || viewState.length === 0) throw new Error('upstream error: invalid viewState, please inform the package maintainer')

	const aspxAuth = await getAspxAuth({ username, password, sessionId, viewState })
	if (typeof aspxAuth !== 'string' || aspxAuth.length === 0) throw new Error('upstream error: invalid aspxAuth, please inform the package maintainer')

	const zipStream = await getZippedData({ sessionId, aspxAuth })
	const dataStream = selectAndParseCsvFromZip(zipStream)

	return dataStream
}

module.exports = zhv
