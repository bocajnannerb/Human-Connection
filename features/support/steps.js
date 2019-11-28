// features/support/steps.js
import { Given, When, Then, After, AfterAll } from 'cucumber'
import Factory from '../../backend/src/seed/factories'
import dotenv from 'dotenv'
import expect from 'expect'

const debug = require('debug')('ea:test:steps')
const factory = Factory()


After(async () => {
  await factory.cleanDatabase()
})

Given('our CLIENT_URI is {string}', function (string) {
  expect(process.env.CLIENT_URI).toEqual(string)
});

Given('we have the following users in our database:', function (dataTable) {
  return Promise.all(dataTable.hashes().map(({ slug, name }) => {
    return factory.create('User', {
      name,
      slug,
    })
  }))
})

When('I send a GET request to {string}', async function (pathname) {
  const response = await this.get(pathname)
  this.lastContentType = response.lastContentType

  this.lastResponses.push(response.lastResponse)
  this.statusCode = response.statusCode
})

Then('the server responds with a HTTP Status {int} and the following json:', function (statusCode, docString) {
  expect(this.statusCode).toEqual(statusCode)
  const [ lastResponse ] = this.lastResponses
  expect(JSON.parse(lastResponse)).toMatchObject(JSON.parse(docString))
})

Then('the Content-Type is {string}', function (contentType) {
  expect(this.lastContentType).toEqual(contentType)
})

