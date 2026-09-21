import re


EVM_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")
TX_HASH_PATTERN = re.compile(r"^0x[a-fA-F0-9]{64}$")


def is_valid_evm_address(value: str) -> bool:
    return bool(EVM_ADDRESS_PATTERN.fullmatch(value))


def is_valid_transaction_hash(value: str) -> bool:
    return bool(TX_HASH_PATTERN.fullmatch(value))