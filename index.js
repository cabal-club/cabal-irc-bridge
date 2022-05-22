#!/usr/bin/env node

var Client = require('cabal-client')
var irc = require('irc')
var minimist = require('minimist')

var args = minimist(process.argv.slice(2))

var usage = `Usage

  cabal-irc-bridge --key cabal://key --cabalChannel default --cabalNick irc-bridge  --ircServer irc.freenode.net --ircChannel "#cabal-club" --ircNick cabal-bridge

  Options:
    --ircServer
    --ircChannel
    --ircNick
    --ircUserName
    --ircPassword
    --ircDebug true|false
    --key
    --cabalChannel
    --cabalNick
`

var key = (args.key || '').replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')

var ircServer = args.ircServer
var ircChannel = args.ircChannel
var ircNick = args.ircNick || 'cabal-bridge'
var ircUserName = args.ircUserName
var ircPassword = args.ircPassword
var ircDebug = args.ircDebug

var cabalChannel = args.cabalChannel || 'default'
var cabalNick = args.cabalNick || 'irc-bridge'

if (!key || !ircServer || !ircChannel) {
  console.log(usage)
  process.exit(1)
}

var cabalClient = new Client({config: { temp: false }})
cabalClient.addCabal(key).then((cabalDetails) => {
  cabalDetails.publishNick(cabalNick)

  function sendCabalMessage (message) {
    cabalDetails.publishMessage({
      type: 'chat/text',
      content: {
        channel: cabalChannel,
        text: message
      }
    })
  }

  function keyToNick (key) {
    var user = cabalDetails.getUsers()[key]
    if (user && user.name) {
      return user.name
    } else {
      return key.substr(0, 5)
    }
  }

  const startTime = (new Date()).getTime()
  cabalDetails.core.messages.events.on(cabalChannel, function (message) {
    if (message && message.value && message.value.content) {
      var text = message.value.content.text
      // Omit relaying old messages or messages published by the bridge
      if (message.value.timestamp >= startTime && message.key !== cabalDetails.getLocalUser().key) {
        ircClient.say(ircChannel, irc.colors.wrap(irc.colors.codes.dark_green, '<' + keyToNick(message.key) + '> ') + text)
      }
    }
  })

  const ircClient = new irc.Client(ircServer, ircNick, {
    autoRejoin: true,
    channels: [],
    debug: !!ircDebug,
    floodProtection: true,
    password: ircPassword,
    realName: 'Cabal/IRC message bridge bot',
    retryCount: 5,
    showErrors: true,
    userName: ircUserName,
    autoConnect: false
  })

  ircClient.connect(() => {
    ircClient.addListener('error', function (message) {
      console.log('==> IRC Error: ', message)
    })

    ircClient.join(ircChannel, function () {
      ircClient.addListener('message', function (from, to, message) {
        message = '<' + from + '> ' + message
        sendCabalMessage(message)
      })
    })

    const startupMessage = '➤ Cabal/IRC bridge started: ' + key.substr(0, 8) + '… with ' + ircChannel
    console.log(startupMessage)
    ircClient.say(ircChannel, startupMessage)
    sendCabalMessage(startupMessage)
  })
})
