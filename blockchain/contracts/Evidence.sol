// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Evidence - Anonymous Evidence Submission on Blockchain
/// @notice Stores IPFS CID and SHA-256 hash pairs immutably on-chain
contract Evidence {
    struct EvidenceRecord {
        string  cid;        // IPFS Content Identifier
        string  hash;       // SHA-256 hash of the original file
        address submitter;  // Wallet that submitted the evidence
        uint256 timestamp;  // Block timestamp of submission
    }

    EvidenceRecord[] private records;

    event EvidenceStored(
        uint256 indexed index,
        string  cid,
        string  hash,
        address indexed submitter,
        uint256 timestamp
    );

    /// @notice Store a new evidence record
    /// @param cid  IPFS CID returned after uploading the file
    /// @param hash SHA-256 hex string of the file
    function storeEvidence(string calldata cid, string calldata hash) external {
        require(bytes(cid).length  > 0, "CID cannot be empty");
        require(bytes(hash).length > 0, "Hash cannot be empty");

        records.push(EvidenceRecord({
            cid:       cid,
            hash:      hash,
            submitter: msg.sender,
            timestamp: block.timestamp
        }));

        emit EvidenceStored(records.length - 1, cid, hash, msg.sender, block.timestamp);
    }

    /// @notice Retrieve a stored evidence record by index
    /// @param index Position in the records array
    function getEvidence(uint256 index)
        external
        view
        returns (
            string  memory cid,
            string  memory hash,
            address submitter,
            uint256 timestamp
        )
    {
        require(index < records.length, "Index out of bounds");
        EvidenceRecord storage r = records[index];
        return (r.cid, r.hash, r.submitter, r.timestamp);
    }

    /// @notice Total number of evidence records stored
    function getEvidenceCount() external view returns (uint256) {
        return records.length;
    }
}
