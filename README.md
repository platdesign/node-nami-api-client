# node-nami-api-client

(unofficial) Nami-Api Client


# Install

`npm install --save @platdesign/nami-api-client`

# Usage

```js
const NamiClient = require('@platdesign/nami-api-client');

const client = new NamiClient({
	userId: '[userId of api user]',
	password: '[users password]',

	// optional
	production: true, // will request nami.dpsg.de / false: namitest.dpsg.de
	version: '1.1', // default: 1.1 / format: Major.Minor
	
	// optional for testing
	productionBaseUrl: 'https://nami.dpsg.de',
	developmentBaseUrl: 'https://namitest.dpsg.de'
});

let members = await client.callService('GET', '/nami/mitglied/filtered-for-navigation/gruppierung/gruppierung/[groupId]', { limit: 2, start: 2 });
```

# Author

[@platdesign](https://twitter.com/platdesign)

