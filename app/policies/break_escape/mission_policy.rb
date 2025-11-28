module BreakEscape
  class MissionPolicy < ApplicationPolicy
    def index?
      true  # Everyone can see mission list
    end

    def show?
      # Published missions or admin
      record.published? || user&.admin? || user&.account_manager?
    end

    def create_game?
      # Anyone authenticated can create a game for a mission they can view
      user.present? && show?
    end

    class Scope < Scope
      def resolve
        if user&.admin? || user&.account_manager?
          scope.all
        else
          scope.published
        end
      end
    end
  end
end
