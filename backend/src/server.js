import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { ApolloServer } from 'apollo-server-express'
import CONFIG, { requiredConfigs } from './config'
import middleware from './middleware'
import { neode as getNeode, getDriver } from './bootstrap/neo4j'
import decode from './jwt/decode'
import schema from './schema'

// check required configs and throw error
// TODO check this directly in config file - currently not possible due to testsetup
Object.entries(requiredConfigs).map(entry => {
  if (!entry[1]) {
    throw new Error(`ERROR: "${entry[0]}" env variable is missing.`)
  }
})

const driver = getDriver()
const neode = getNeode()

export const context = async ({ req }) => {
  const user = await decode(driver, req.headers.authorization)
  return {
    driver,
    neode,
    user,
    req,
    cypherParams: {
      currentUserId: user ? user.id : null,
    },
  }
}

const createServer = options => {
  const defaults = {
    context,
    schema: middleware(schema),
    debug: !!CONFIG.DEBUG,
    tracing: !!CONFIG.DEBUG,
  }
  const server = new ApolloServer(Object.assign({}, defaults, options))

  const app = express()
  app.use(helmet())
  app.use(express.static('public'))
  app.use(cors())
  server.applyMiddleware({ app, path: '/' })

  return { server, app }
}

export default createServer
