// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialERC20Wrapped} from "./dependencies/token/ERC20/ConfidentialERC20Wrapped.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialWETH is ConfidentialERC20Wrapped, SepoliaConfig {
    constructor(address token_) ConfidentialERC20Wrapped(token_, 0) {}
}
