pragma solidity ^0.8.0;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedSimpleVoting is SepoliaConfig {
    enum VotingStatus {
        Open,
        DecryptionInProgress,
        ResultsDecrypted
    }
    mapping(address => bool) public hasVoted;

    VotingStatus public status;

    uint64 public decryptedYesVotes;
    uint64 public decryptedNoVotes;

    uint256 public voteDeadline;

    euint64 private encryptedYesVotes;
    euint64 private encryptedNoVotes;

    constructor() {
        encryptedYesVotes = FHE.asEuint64(0);
        encryptedNoVotes = FHE.asEuint64(0);

        FHE.allowThis(encryptedYesVotes);
        FHE.allowThis(encryptedNoVotes);
    }

    function vote(externalEbool support, bytes memory inputProof) public {
        require(block.timestamp <= voteDeadline, "Too late to vote");
        require(!hasVoted[msg.sender], "Already voted");
        hasVoted[msg.sender] = true;
        ebool isSupport = FHE.fromExternal(support, inputProof);
        encryptedYesVotes = FHE.select(isSupport, FHE.add(encryptedYesVotes, 1), encryptedYesVotes);
        encryptedNoVotes = FHE.select(isSupport, encryptedNoVotes, FHE.add(encryptedNoVotes, 1));
        FHE.allowThis(encryptedYesVotes);
        FHE.allowThis(encryptedNoVotes);
        
    }

    function requestVoteDecryption() public {
        require(block.timestamp > voteDeadline, "Voting is not finished");
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(encryptedYesVotes);
        cts[1] = FHE.toBytes32(encryptedNoVotes);
        uint256 requestId = FHE.requestDecryption(cts, this.callbackDecryptVotes.selector);
        status = VotingStatus.DecryptionInProgress;
    }

    function callbackDecryptVotes(uint256 requestId, uint64 yesVotes, uint64 noVotes, bytes[] memory signatures) public {
        FHE.checkSignatures(requestId, signatures);
        decryptedYesVotes = yesVotes;
        decryptedNoVotes = noVotes;
        status = VotingStatus.ResultsDecrypted;
    }

    function getResults() public view returns (uint64, uint64) {
        require(status == VotingStatus.ResultsDecrypted, "Results were not decrypted");
        return (
            decryptedYesVotes,
            decryptedNoVotes
        );
    }
}