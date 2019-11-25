import extractMentionedUsers from './mentions/extractMentionedUsers'

const postAuthorOfComment = async (comment, { context }) => {
  const session = context.driver.session()
  const cypherFindUser = `
    MATCH (user: User)-[:WROTE]->(:Post)<-[:COMMENTS]-(:Comment { id: $commentId })
    RETURN user { .id }
    `
  const result = await session.run(cypherFindUser, {
    commentId: comment.id,
  })
  session.close()
  const [postAuthor] = await result.records.map(record => {
    return record.get('user')
  })
  return postAuthor
}

const notifyUsers = async (label, id, idsOfUsers, reason, context) => {
  if (!idsOfUsers.length) return

  // Checked here, because it does not go through GraphQL checks at all in this file.
  const reasonsAllowed = ['mentioned_in_post', 'mentioned_in_comment', 'commented_on_post']
  if (!reasonsAllowed.includes(reason)) {
    throw new Error('Notification reason is not allowed!')
  }
  if (
    (label === 'Post' && reason !== 'mentioned_in_post') ||
    (label === 'Comment' && !['mentioned_in_comment', 'commented_on_post'].includes(reason))
  ) {
    throw new Error('Notification does not fit the reason!')
  }

  const session = context.driver.session()
  let cypher
  switch (reason) {
    case 'mentioned_in_post': {
      cypher = `
        MATCH (post: Post { id: $id })<-[:WROTE]-(author: User)
        MATCH (user: User)
        WHERE user.id in $idsOfUsers
        AND NOT (user)<-[:BLOCKED]-(author)
        MERGE (post)-[notification:NOTIFIED {reason: $reason}]->(user)
        SET notification.read = FALSE
        SET (
        CASE
        WHEN notification.createdAt IS NULL
        THEN notification END ).createdAt = toString(datetime())
        SET notification.updatedAt = toString(datetime())
      `
      break
    }
    case 'mentioned_in_comment': {
      cypher = `
        MATCH (postAuthor: User)-[:WROTE]->(post: Post)<-[:COMMENTS]-(comment: Comment { id: $id })<-[:WROTE]-(author: User)
        MATCH (user: User)
        WHERE user.id in $idsOfUsers
        AND NOT (user)<-[:BLOCKED]-(author)
        AND NOT (user)<-[:BLOCKED]-(postAuthor)
        MERGE (comment)-[notification:NOTIFIED {reason: $reason}]->(user)
        SET notification.read = FALSE
        SET (
        CASE
        WHEN notification.createdAt IS NULL
        THEN notification END ).createdAt = toString(datetime())
        SET notification.updatedAt = toString(datetime())
      `
      break
    }
    case 'commented_on_post': {
      cypher = `
        MATCH (postAuthor: User)-[:WROTE]->(post: Post)<-[:COMMENTS]-(comment: Comment { id: $id })<-[:WROTE]-(author: User)
        MATCH (user: User)
        WHERE user.id in $idsOfUsers
        AND NOT (user)<-[:BLOCKED]-(author)
        AND NOT (author)<-[:BLOCKED]-(user)
        MERGE (comment)-[notification:NOTIFIED {reason: $reason}]->(user)
        SET notification.read = FALSE
        SET (
        CASE
        WHEN notification.createdAt IS NULL
        THEN notification END ).createdAt = toString(datetime())
        SET notification.updatedAt = toString(datetime())
      `
      break
    }
  }
  await session.run(cypher, {
    id,
    idsOfUsers,
    reason,
  })
  session.close()
}

const handleContentDataOfPost = async (resolve, root, args, context, resolveInfo) => {
  const idsOfUsers = extractMentionedUsers(args.content)

  const post = await resolve(root, args, context, resolveInfo)

  if (post) {
    await notifyUsers('Post', post.id, idsOfUsers, 'mentioned_in_post', context)
  }

  return post
}

const handleContentDataOfComment = async (resolve, root, args, context, resolveInfo) => {
  let idsOfUsers = extractMentionedUsers(args.content)
  const comment = await resolve(root, args, context, resolveInfo)

  if (comment) {
    const postAuthor = await postAuthorOfComment(comment, { context })
    idsOfUsers = idsOfUsers.filter(id => id !== postAuthor.id)

    await notifyUsers('Comment', comment.id, idsOfUsers, 'mentioned_in_comment', context)
  }

  return comment
}

const handleCreateComment = async (resolve, root, args, context, resolveInfo) => {
  const comment = await handleContentDataOfComment(resolve, root, args, context, resolveInfo)

  if (comment) {
    const session = context.driver.session()
    const cypherFindUser = `
    MATCH (user: User)-[:WROTE]->(:Post)<-[:COMMENTS]-(:Comment { id: $commentId })
    RETURN user { .id }
    `
    const result = await session.run(cypherFindUser, {
      commentId: comment.id,
    })
    session.close()
    const [postAuthor] = await result.records.map(record => {
      return record.get('user')
    })
    if (context.user.id !== postAuthor.id) {
      await notifyUsers('Comment', comment.id, [postAuthor.id], 'commented_on_post', context)
    }
  }

  return comment
}

export default {
  Mutation: {
    CreatePost: handleContentDataOfPost,
    UpdatePost: handleContentDataOfPost,
    CreateComment: handleCreateComment,
    UpdateComment: handleContentDataOfComment,
  },
}
