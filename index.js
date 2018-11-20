#!/usr/bin/env node

var Cabal = require('cabal-core')
var swarm = require('cabal-core/swarm.js')
var irc = require('irc')
var minimist = require('minimist')

var args = minimist(process.argv.slice(2))

var usage = `Usage

  cabal-irc-bridge --key cabal://key --db path/to/db --cabalChannel default --cabalNick irc-bridge  --ircServer irc.freenode.net --ircChannel "#cabal-club" --ircNick cabal-bridge

  Options:
    --ircServer
    --ircChannel
    --ircNick
    --key
    --db
    --cabalChannel
    --cabalNick
`

var key = args.key
var storage = args.db

var ircServer = args.ircServer
var ircChannel = args.ircChannel
var ircNick = args.ircNick || 'cabal-bridge'

var cabalChannel = args.cabalChannel || 'default'
var cabalNick = args.cabalNick || 'irc-bridge'

if (!key || !storage || !ircServer || !ircChannel) {
  console.log(usage)
  process.exit(1)
}

console.log('➤ Bridge started: ' + key.substr(0, 8) + '… with ' + ircChannel)

var ircClient = new irc.Client(ircServer, ircNick, {
  channels: [ircChannel]
})

ircClient.addListener('error', function (message) {
  console.log('irc error: ', message)
})

var cabalUsers = {}
var localUserKey

var cabal = Cabal(storage, key)
cabal.db.ready(() => {
  swarm(cabal)

  cabal.publishNick(cabalNick)

  cabal.getLocalKey(function (err, lkey) {
    if (err) return
    localUserKey = lkey
  })

  cabal.messages.events.on(cabalChannel, function (message) {
    if (message && message.value && message.value.content) {
      var text = message.value.content.text
      // Omit relaying messages published by the bridge
      if (message.key !== localUserKey) {
        ircClient.say(ircChannel, '<' + keyToNick(message.key) + '> ' + text)
      }
    }
  })

  cabal.users.getAll(function (err, users) {
    if (err) return
    cabalUsers = users

    cabal.users.events.on('update', function (key) {
      cabal.users.get(key, function (err, user) {
        if (err) return
        cabalUsers[key] = Object.assign(cabalUsers[key] || {}, user)
      })
    })
    cabal.on('peer-added', function (key) {
      var found = false
      Object.keys(cabalUsers).forEach(function (k) {
        if (k === key) {
          found = true
        }
      })
      if (!found) {
        cabalUsers[key] = {
          key: key
        }
      }
    })
  })

  ircClient.addListener('message', function (from, to, message) {
    cabal.publish({
      type: 'chat/text',
      content: {
        channel: cabalChannel,
        text: '<' + from + '> ' + message
      }
    })
  })
})

function keyToNick (key) {
  var user = cabalUsers[key]
  if (user && user.name) {
    return user.name
  } else {
    return key.substr(0, 5)
  }
}
