from app.rpc import CONTRACT_ERRORS, contract_error_message


def test_translates_known_contract_revert_selector() -> None:
    selector = next(
        selector
        for selector, message in CONTRACT_ERRORS.items()
        if message == "Recipient is not on the wallet allowlist"
    )
    assert contract_error_message(
        {"code": 3, "message": f"execution reverted: {selector}"}
    ) == "Recipient is not on the wallet allowlist"


def test_preserves_unknown_rpc_error_message() -> None:
    assert contract_error_message(
        {"code": -32000, "message": "upstream rejected the request"}
    ) == "upstream rejected the request"
