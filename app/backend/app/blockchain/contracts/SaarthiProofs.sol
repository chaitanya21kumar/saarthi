// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SaarthiProofs {
    event ProofStored(bytes32 indexed key, address indexed by, string typ, string meta);
    mapping(bytes32 => string) public metaOf;

    function storeProof(bytes32 key, string calldata typ, string calldata meta) external {
        metaOf[key] = meta;
        emit ProofStored(key, msg.sender, typ, meta);
    }
}
