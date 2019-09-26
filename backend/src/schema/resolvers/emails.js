import generateNonce from './helpers/generateNonce'
import Resolver from './helpers/Resolver'
import existingEmailAddress from './helpers/existingEmailAddress'
import { UserInputError } from 'apollo-server'
import Validator from 'neode/build/Services/Validator.js'

export default {
  Mutation: {
    AddEmailAddress: async (_parent, args, context, _resolveInfo) => {
      try {
        const { neode } = context
        await new Validator(neode, neode.model('EmailAddressRequest'), args)
      } catch (e) {
        throw new UserInputError('must be a valid email')
      }

      let response = await existingEmailAddress(_parent, args, context)
      if (response) return response

      const nonce = generateNonce()
      const {
        user: { id: userId },
      } = context
      const { email } = args
      const session = context.driver.session()
      const writeTxResultPromise = session.writeTransaction(async txc => {
        const result = await txc.run(
          `
            MATCH (user:User {id: $userId})
            MERGE (user)<-[:BELONGS_TO]-(email:EmailAddressRequest {email: $email, nonce: $nonce})
            SET email.createdAt = toString(datetime())
            RETURN email
          `,
          { userId, email, nonce },
        )
        return result.records.map(record => record.get('email').properties)
      })
      try {
        const txResult = await writeTxResultPromise
        response = txResult[0]
      } finally {
        session.close()
      }
      return response
    },
    VerifyEmailAddress: async (_parent, args, context, _resolveInfo) => {
      let response
      const {
        user: { id: userId },
      } = context
      const { nonce, email } = args
      const session = context.driver.session()
      const writeTxResultPromise = session.writeTransaction(async txc => {
        const result = await txc.run(
          `
            MATCH (user:User {id: $userId})-[previous:PRIMARY_EMAIL]->(:EmailAddress)
            MATCH (user)<-[:BELONGS_TO]-(email:EmailAddressRequest {email: $email, nonce: $nonce})
            MERGE (user)-[:PRIMARY_EMAIL]->(email)
            SET email:EmailAddress
            SET email.verifiedAt = toString(datetime())
            REMOVE email:EmailAddressRequest
            DELETE previous
            RETURN email
          `,
          { userId, email, nonce },
        )
        return result.records.map(record => record.get('email').properties)
      })
      try {
        const txResult = await writeTxResultPromise
        response = txResult[0]
      } catch (e) {
        if (e.code === 'Neo.ClientError.Schema.ConstraintValidationFailed')
          throw new UserInputError('A user account with this email already exists.')
        throw new Error(e)
      } finally {
        session.close()
      }
      if (!response) throw new UserInputError('Invalid nonce or no email address found.')
      return response
    },
  },
  EmailAddress: {
    ...Resolver('EmailAddress', {
      undefinedToNull: ['verifiedAt'],
    }),
  },
}
