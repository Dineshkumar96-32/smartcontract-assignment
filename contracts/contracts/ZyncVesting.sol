// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ZyncVesting is Ownable, ReentrancyGuard {

    IERC20 public immutable zyncToken;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
    }

    mapping(address => VestingSchedule) public vestingSchedules;

    constructor(address tokenAddress) Ownable(msg.sender) {
        zyncToken = IERC20(tokenAddress);
    }

    function fund(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");

        bool success = zyncToken.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        require(success, "Token transfer failed");
    }

          function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint64 start,
        uint64 cliff,
        uint64 duration
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Invalid amount");
        require(duration > 0, "Invalid duration");

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            released: 0,
            start: start,
            cliff: cliff,
            duration: duration
        });
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];

        if (block.timestamp < schedule.start + schedule.cliff) {
            return 0;
        }

        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        }

        return
            (schedule.totalAmount *
                (block.timestamp - schedule.start)) /
            schedule.duration;
    }

    function release() external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];

        uint256 vested = vestedAmount(msg.sender);
        uint256 releasable = vested - schedule.released;

        require(releasable > 0, "No tokens to release");

        schedule.released += releasable;

        bool success = zyncToken.transfer(msg.sender, releasable);
        require(success, "Transfer failed");
    }
}