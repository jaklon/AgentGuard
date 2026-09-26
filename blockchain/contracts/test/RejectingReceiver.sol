// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentGuardBalance {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}

contract RejectingReceiver {
    function depositInto(address guard) external payable {
        IAgentGuardBalance(guard).deposit{value: msg.value}();
    }

    function withdrawFrom(address guard, uint256 amount) external {
        IAgentGuardBalance(guard).withdraw(amount);
    }

    receive() external payable {
        revert("transfer rejected");
    }
}
