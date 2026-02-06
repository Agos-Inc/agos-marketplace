// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract PaymentRouter {
    event OrderPaid(
        bytes32 indexed orderId,
        bytes32 indexed serviceId,
        address indexed buyer,
        address supplier,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    error ZeroAddress();
    error ZeroAmount();

    function payForService(
        bytes32 orderId,
        bytes32 serviceId,
        address supplier,
        address token,
        uint256 amount
    ) external {
        if (supplier == address(0) || token == address(0)) {
            revert ZeroAddress();
        }

        if (amount == 0) {
            revert ZeroAmount();
        }

        IERC20(token).transferFrom(msg.sender, supplier, amount);

        emit OrderPaid(orderId, serviceId, msg.sender, supplier, token, amount, block.timestamp);
    }
}
