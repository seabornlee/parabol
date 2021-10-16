import graphql from 'babel-plugin-relay/macro'
import {commitMutation} from 'react-relay'
import {StandardMutation} from '../types/relayMutations'
import {UpdateIntegrationProviderMutation as TUpdateIntegrationProviderMutation} from '../__generated__/UpdateIntegrationProviderMutation.graphql'

graphql`
  fragment UpdateIntegrationProviderMutation_part on UpdateIntegrationProviderSuccess {
    user {
      ...MattermostPanel_viewer
    }
  }
`

const mutation = graphql`
  mutation UpdateIntegrationProviderMutation(
    $provider: UpdateIntegrationProviderInput!
    $teamId: ID!
  ) {
    updateIntegrationProvider(provider: $provider) {
      ... on ErrorPayload {
        error {
          message
        }
      }
      ...UpdateIntegrationProviderMutation_part @relay(mask: false)
    }
  }
`

const UpdateIntegrationProviderMutation: StandardMutation<TUpdateIntegrationProviderMutation> = (
  atmosphere,
  variables,
  {onError, onCompleted}
) => {
  return commitMutation<TUpdateIntegrationProviderMutation>(atmosphere, {
    mutation,
    variables,
    onCompleted,
    onError
  })
}

export default UpdateIntegrationProviderMutation