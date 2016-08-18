import { mapFieldsToModel } from './lib/utils'
import { r, User } from '../models'
import { accessRequired } from './errors'

export const schema = `
  type User {
    id: ID
    firstName: String
    lastName: String
    displayName: String
    email: String
    cell: String
    organizations(role: String): [Organization]
    todos(organizationId: String): [Assignment]
    roles(organizationId: String!): [String]
    assignedCell: Phone
    assignment(id:String!): Assignment
  }
`

export const resolvers = {
  User: {
    ...mapFieldsToModel([
      'id',
      'firstName',
      'lastName',
      'email',
      'cell',
      'assignedCell'
    ], User),
    displayName: (user) => `${user.first_name} ${user.last_name}`,
    organizations: async (user, { role }) => {
      let orgs = r.table('user_organization')
        .getAll(user.id, { index: 'user_id' })
      if (role) {
        orgs = orgs.filter((roles) => roles('roles').contains(role))
      }
      return orgs.eqJoin('organization_id', r.table('organization'))('right')
    },
    roles: async(user, { organizationId }) => (
      r.table('user_organization')
        .getAll(organizationId, { index: 'organization_id' })
        .filter({ user_id: user.id })
        .limit(1)(0)
        .pluck('roles')('roles')
    ),
    todos: async (user, { organizationId }) => (
      r.table('assignment')
        .getAll(user.id, { index: 'user_id' })
        .eqJoin('campaign_id', r.table('campaign'))
        .filter((row) => row('right')('organization_id').eq(organizationId))('left')
    ),
    assignment: async (_, { id }, { loaders, user }) => {
      const assignment = await loaders.assignment.load(id)
      const campaign = await loaders.campaign.load(assignment.campaign_id)
      await accessRequired(user, campaign.organization_id, 'TEXTER')
      return assignment
    }
  }
}