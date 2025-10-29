// Test Ink script for development
VAR test_counter = 0
VAR player_visited_room = false

=== start ===
# speaker: TestNPC
# type: bark
Hello! This is a test message from Ink.
~ test_counter++
-> END

=== test_room_reception ===
# speaker: TestNPC
# type: bark
{player_visited_room:
    You're back in reception.
- else:
    Welcome to reception! This is your first time here.
    ~ player_visited_room = true
}
-> END

=== test_item_lockpick ===
# speaker: TestNPC
# type: bark
You picked up a lockpick! Nice find.
~ test_counter++
-> END

=== hub ===
# speaker: TestNPC
# type: conversation
What would you like to test?
Counter: {test_counter}
+ [Test choice 1] -> test_1
+ [Test choice 2] -> test_2
+ [Exit] -> END

=== test_1 ===
# speaker: TestNPC
You selected test choice 1!
Counter: {test_counter}
-> hub

=== test_2 ===
# speaker: TestNPC
You selected test choice 2!
~ test_counter++
-> hub
