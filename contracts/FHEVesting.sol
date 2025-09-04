// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialERC20} from "./dependencies/token/ERC20/IConfidentialERC20.sol";

contract FHEVesting is SepoliaConfig {
    using FHE for *;

    IConfidentialERC20 public immutable token;
    uint64 public immutable start;
    uint64 public immutable duration;
    address public immutable beneficiary;

    euint64 public released;

    constructor(address token_, address beneficiary_, uint32 start_, uint32 duration_) {
        token = IConfidentialERC20(token_);
        beneficiary = beneficiary_;
        start = start_;
        duration = duration_;

        released = 0.asEuint64();
        released.allowThis();
        released.allow(beneficiary_);
    }

    function end() public view returns (uint256) {
        return start + duration;
    }

    function release() public {
        euint64 amount = vestedAmount(uint64(block.timestamp)).sub(released);

        released = released.add(amount);

        amount.allowTransient(address(token));

        token.transfer(beneficiary, amount);
    }

    function vestedAmount(uint64 timestamp) public returns (euint64) {
        return _vestingSchedule(token.balanceOf(address(this)).add(released), timestamp);
    }

    function _vestingSchedule(euint64 totalAllocation, uint64 timestamp) internal returns (euint64) {
        if (timestamp < start) {
            return 0.asEuint64();
        } else if (timestamp >= end()) {
            return totalAllocation;
        } else {
            return (totalAllocation.mul(timestamp.asEuint64().sub(start.asEuint64()))).div(duration);
        }
    }
}
