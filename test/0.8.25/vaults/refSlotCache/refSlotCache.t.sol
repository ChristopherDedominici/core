// SPDX-License-Identifier: UNLICENSED
// for testing purposes only

pragma solidity 0.8.25;

import "forge-std/Test.sol";

import {DoubleRefSlotCache, DOUBLE_CACHE_LENGTH} from "contracts/0.8.25/vaults/lib/RefSlotCache.sol";
import {IHashConsensus} from "contracts/common/interfaces/IHashConsensus.sol";

contract DoubleRefSlotCacheExample {
    using DoubleRefSlotCache for DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH];

    DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] public intCacheStorage;

    uint256 public refSlot;

    // try/catch replicates Foundry's per-test `fail-on-revert = false`
    // which Hardhat v3 doesn't support via inline forge-config comments
    function increaseIntValue(
        int104 increment
    ) external returns (DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] memory) {
        try this._doIncreaseIntValue(increment) returns (
            DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] memory newStorage
        ) {
            intCacheStorage = newStorage;
            return newStorage;
        } catch {
            return intCacheStorage;
        }
    }

    function _doIncreaseIntValue(
        int104 increment
    ) external returns (DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] memory) {
        return intCacheStorage.withValueIncrease(IHashConsensus(address(this)), increment);
    }

    function increaseRefSlot() external {
        refSlot++;
    }

    function getIntCurrentValue() external view returns (int104) {
        return intCacheStorage.currentValue();
    }

    function getIntValueForRefSlot(uint256 _refSlot) external view returns (int104) {
        return intCacheStorage.getValueForRefSlot(uint48(_refSlot));
    }

    function getIntCacheStorage()
        external
        view
        returns (DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] memory)
    {
        return intCacheStorage;
    }

    function getCurrentFrame() external view returns (uint256, uint256) {
        return (refSlot, refSlot + 1);
    }
}

contract DoubleRefSlotCacheTest is Test {
    DoubleRefSlotCacheExample example;

    function setUp() public {
        example = new DoubleRefSlotCacheExample();

        // Configure target selectors for invariant testing
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = DoubleRefSlotCacheExample.increaseIntValue.selector;
        selectors[1] = DoubleRefSlotCacheExample.increaseRefSlot.selector;

        targetSelector(FuzzSelector({addr: address(example), selectors: selectors}));

        // Also set the target contract
        targetContract(address(example));
    }

    /**
     * invariant 1. the current value should be equal to the value for the next refSlot
     *
     * Foundry inline config (ignored by HH3, kept for reference):
     * forge-config: default.invariant.runs = 32
     * forge-config: default.invariant.depth = 32
     * forge-config: default.invariant.fail-on-revert = false
     * HH3 uses global invariant config in hardhat.config.ts instead.
     * `fail-on-revert = false` is handled by the try/catch in increaseIntValue().
     */
    function invariant_currentValue() external {
        assertEq(example.getIntCurrentValue(), example.getIntValueForRefSlot(example.refSlot() + 1));
    }

    /**
     * invariant 2. the value on refSlot should be equal to the previous value
     *
     * Foundry inline config (ignored by HH3, kept for reference):
     * forge-config: default.invariant.runs = 128
     * forge-config: default.invariant.depth = 128
     * forge-config: default.invariant.fail-on-revert = false
     * HH3 uses global invariant config in hardhat.config.ts instead.
     * `fail-on-revert = false` is handled by the try/catch in increaseIntValue().
     */
    function invariant_valueOnRefSlot() external {
        DoubleRefSlotCache.Int104WithCache[DOUBLE_CACHE_LENGTH] memory cache = example.getIntCacheStorage();
        uint256 activeIndex = cache[0].refSlot >= cache[1].refSlot ? 0 : 1;
        uint256 previousIndex = 1 - activeIndex;
        assertEq(cache[activeIndex].valueOnRefSlot, cache[previousIndex].value);
    }
}
