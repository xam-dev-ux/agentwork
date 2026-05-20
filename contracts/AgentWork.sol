// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * AgentWork — on-chain task escrow for AI agents.
 *
 * Flow:
 *   1. Human calls postTask()    → locks USDC in contract
 *   2. Agent calls claimTask()   → reserves the task
 *   3. Agent calls submitResult() → releases USDC to agent automatically
 *   4. Human calls refund()      → only if agent times out (>1h after claim)
 */
contract AgentWork {
    IERC20 public immutable usdc;

    uint256 public constant CLAIM_TIMEOUT = 1 hours;

    enum TaskState { Open, Claimed, Completed, Refunded }

    struct Task {
        uint256  id;
        address  poster;
        string   description;
        uint256  reward;
        address  agent;
        string   result;
        TaskState state;
        uint256  createdAt;
        uint256  claimedAt;
    }

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;

    event TaskPosted   (uint256 indexed taskId, address indexed poster, string description, uint256 reward);
    event TaskClaimed  (uint256 indexed taskId, address indexed agent);
    event TaskCompleted(uint256 indexed taskId, address indexed agent, string result);
    event TaskPaid     (uint256 indexed taskId, address indexed agent, uint256 amount);
    event TaskRefunded (uint256 indexed taskId, address indexed poster, uint256 amount);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ── Write functions ───────────────────────────────────────────────────────

    function postTask(string calldata description, uint256 reward)
        external returns (uint256 taskId)
    {
        require(reward > 0,                       "Reward must be > 0");
        require(bytes(description).length > 0,    "Description required");
        require(
            usdc.transferFrom(msg.sender, address(this), reward),
            "USDC transfer failed - approve first"
        );

        taskId = taskCount++;
        tasks[taskId] = Task({
            id:          taskId,
            poster:      msg.sender,
            description: description,
            reward:      reward,
            agent:       address(0),
            result:      "",
            state:       TaskState.Open,
            createdAt:   block.timestamp,
            claimedAt:   0
        });

        emit TaskPosted(taskId, msg.sender, description, reward);
    }

    function claimTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.state == TaskState.Open,     "Task not open");
        require(task.poster != msg.sender,        "Poster cannot claim own task");

        task.agent     = msg.sender;
        task.state     = TaskState.Claimed;
        task.claimedAt = block.timestamp;

        emit TaskClaimed(taskId, msg.sender);
    }

    function submitResult(uint256 taskId, string calldata result) external {
        Task storage task = tasks[taskId];
        require(task.state == TaskState.Claimed,  "Task not claimed");
        require(msg.sender == task.agent,         "Not the assigned agent");
        require(bytes(result).length > 0,         "Result required");

        task.result = result;
        task.state  = TaskState.Completed;

        // Auto-pay: USDC goes directly to agent on result submission
        require(usdc.transfer(task.agent, task.reward), "USDC payment failed");

        emit TaskCompleted(taskId, msg.sender, result);
        emit TaskPaid(taskId, msg.sender, task.reward);
    }

    function refund(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.poster == msg.sender,        "Not task poster");
        require(
            task.state == TaskState.Open ||
            (task.state == TaskState.Claimed &&
             block.timestamp > task.claimedAt + CLAIM_TIMEOUT),
            "Cannot refund yet"
        );

        task.state = TaskState.Refunded;
        require(usdc.transfer(task.poster, task.reward), "USDC refund failed");

        emit TaskRefunded(taskId, msg.sender, task.reward);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getAllTasks() external view returns (Task[] memory) {
        Task[] memory result = new Task[](taskCount);
        for (uint256 i = 0; i < taskCount; i++) {
            result[i] = tasks[i];
        }
        return result;
    }

    function getOpenTasks() external view returns (Task[] memory) {
        uint256 count;
        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].state == TaskState.Open) count++;
        }
        Task[] memory result = new Task[](count);
        uint256 idx;
        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].state == TaskState.Open) result[idx++] = tasks[i];
        }
        return result;
    }
}
