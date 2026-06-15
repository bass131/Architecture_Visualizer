interface IActionContract
{
    bool Execute(int context);
}

class ContractBypassAction : IActionContract
{
    public bool Execute(int context)
    {
        return false;
    }

    internal bool ExecuteWithPayload(int context, int payload)
    {
        return payload > context;
    }
}
