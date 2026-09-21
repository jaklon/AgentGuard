# Contributing

main is release-ready and protected by review. Each developer works in a personal clone and creates a pull request from the branch defined in the implementation plan:

- jascon/guard-engine — guard, smart contract, infrastructure, integration
- rafly/frontend — frontend
- syahrafi/backend — backend
- hotfix/short-description — approved production fix

Before opening a pull request:

1. Rebase or merge the current main into the feature branch.
2. Run the relevant tests and include the result in the pull request.
3. Check that API examples and frontend types still agree.
4. Confirm no .env, key, raw production prompt, database, or build artifact is staged.
5. Keep /srv/agentguard deployment-only; never edit source there.

At least one teammate reviews changes. Contract, environment, CORS, Docker, or release changes require Project Lead review.
