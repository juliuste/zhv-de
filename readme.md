# zhv-de

Fetch the most up-to-date release of the german central public transport stop registry ([Zentrales Haltestellenverzeichnis, ZHV](https://zhv.wvigmbh.de/)). Sadly, there is no static endpoint from which you could obtain this data (yet), you can use this small tool until they provide one.

[![npm version](https://img.shields.io/npm/v/zhv-de.svg)](https://www.npmjs.com/package/zhv-de)
[![Build Status](https://travis-ci.org/juliuste/zhv-de.svg?branch=master)](https://travis-ci.org/juliuste/zhv-de)
[![Greenkeeper badge](https://badges.greenkeeper.io/juliuste/zhv-de.svg)](https://greenkeeper.io/)
[![dependency status](https://img.shields.io/david/juliuste/zhv-de.svg)](https://david-dm.org/juliuste/zhv-de)
[![license](https://img.shields.io/github/license/juliuste/zhv-de.svg?style=flat)](license)
[![chat on gitter](https://badges.gitter.im/juliuste.svg)](https://gitter.im/juliuste)

## Installation

```shell
npm install zhv-de
```

## Usage

The module exposes a single method which takes `username` and `password` (you can obtain those credentials for free [at the ZHV website](https://zhv.wvigmbh.de/Account/Register.aspx)) as arguments and returns a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/promise) that will resolve in an object-mode stream of stops.

```js
const zhv = require('zhv-de')
const username = '<your-zhv-username>'
const password = '<your-zhv-password>'

const ndjson = require('ndjson') // we use this to transform objects to JSON to pipe to stdout

zhv(username, password)
.then(dataStream => dataStream.pipe(ndjson.stringify()).pipe(process.stdout))
.catch(console.error)
```

The objects emitted by the stream will look as follows (note that the keys start with a lowercase character instead of the uppercase variant used on the ZHV website):

```js
{
	seqNo: '0',
	type: 'S',
	dHID: 'de:07334:1714',
	parent: 'de:07334:1714',
	name: 'Wörth Alte Bahnmeisterei',
	latitude: 49.048672,
	longitude: 8.266324,
	municipalityCode: '07334501',
	municipality: 'Wörth am Rhein',
	districtCode: null,
	district: null,
	condition: 'Served',
	state: undefined,
	description: undefined,
	authority: 'NVBW'
}
```

## Contributing

If you found a bug or want to propose a feature, feel free to visit [the issues page](https://github.com/juliuste/zhv-de/issues).
